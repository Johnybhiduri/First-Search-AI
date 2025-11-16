import React, { useState, useRef, useEffect } from "react";
import { InferenceClient } from "@huggingface/inference";
import ReactMarkdown from "react-markdown";
import { RiAiGenerate2 } from "react-icons/ri";

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
  imageUrl?: string; // New field for image URLs
}

interface ChatPageProps {
  isVerified: boolean;
  api_key: string;
  selectedModel: string | null;
  selectedPipeline: string | null;
}

const ChatPage: React.FC<ChatPageProps> = ({
  isVerified,
  selectedModel,
  selectedPipeline,
  api_key,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! Welcome to First Search AI Assistant. How can I assist you today?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      inputMessage.trim() === "" ||
      !isVerified ||
      !selectedModel ||
      !selectedPipeline
    )
      return;

    // Check if only text-generation and text-to-image models are supported
    if (
      selectedPipeline !== "text-generation" &&
      selectedPipeline !== "text-to-image"
    ) {
      const errorMessage: Message = {
        id: messages.length + 2,
        text: "Currently only text generation and text-to-image models are working. We will add support for other pipelines in upcoming versions.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setInputMessage("");
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: messages.length + 1,
      text: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      if (selectedPipeline === "text-generation") {
        await handleTextGeneration(inputMessage);
      } else if (selectedPipeline === "text-to-image") {
        await handleImageGeneration(inputMessage);
      }
    } catch (error) {
      console.error("Error processing request:", error);

      // Update with error message
      const errorMessage: Message = {
        id: messages.length + 2,
        text: "Sorry, I encountered an error while processing your request. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        // Remove any loading message and add error message
        const filtered = prev.filter((msg) => msg.id !== messages.length + 2);
        return [...filtered, errorMessage];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextGeneration = async (userInput: string) => {
    // Initialize the bot message with empty text
    const botMessageId = messages.length + 2;
    const botMessage: Message = {
      id: botMessageId,
      text: "",
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, botMessage]);

    try {
      // Create InferenceClient with user's API key
      const client = new InferenceClient(api_key);

      const stream = client.chatCompletionStream({
        model: selectedModel as string,
        messages: [
          ...messages.map((msg) => ({
            role: msg.isUser ? ("user" as const) : ("assistant" as const),
            content: msg.text,
          })),
          {
            role: "user" as const,
            content: userInput,
          },
        ],
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices.length > 0) {
          const newContent = chunk.choices[0]?.delta?.content || "";
          fullResponse += newContent;

          // Update the bot message with streaming content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId ? { ...msg, text: fullResponse } : msg
            )
          );
        }
      }
    } catch (error: unknown) {
      console.error("Error streaming response:", error);

      let errorMessage =
        "Sorry, I encountered an error while processing your request. Please try again.";

      // Check if it's a credit limit error - handle both Error and ProviderApiError
      const errorMessageString =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : String(error);

      if (
        errorMessageString.includes("exceeded your monthly included credits") ||
        errorMessageString.includes("Subscribe to PRO")
      ) {
        errorMessage =
          "You have exceeded your monthly Hugging Face credits. Please upgrade to PRO or wait until your credits reset.";
      }

      // Update the bot message with error
      const errorMessageObj: Message = {
        id: botMessageId,
        text: errorMessage,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        // Remove the loading message and add error message
        const filtered = prev.filter((msg) => msg.id !== botMessageId);
        return [...filtered, errorMessageObj];
      });
    }
  };

  const handleImageGeneration = async (prompt: string) => {
    // Create a loading message for image generation
    const loadingMessage: Message = {
      id: messages.length + 2,
      text: `Generating image for: "${prompt}"...`,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      // Create InferenceClient with user's API key
      const client = new InferenceClient(api_key);

      // Generate image using text-to-image with blob output
      const imageBlob = await client.textToImage(
        {
          model: selectedModel as string,
          inputs: prompt,
          parameters: {
            num_inference_steps: 20,
          },
        },
        {
          outputType: "blob" as const,
        }
      );

      // Convert blob to data URL
      const imageUrl = URL.createObjectURL(imageBlob);

      // Replace the loading message with the actual image
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                text: `Generated image for: "${prompt}"`,
                imageUrl: imageUrl,
              }
            : msg
        )
      );
    } catch (error: unknown) {
      console.error("Error generating image:", error);

      let errorMessage =
        "Sorry, I encountered an error while generating the image. Please try again.";

      // Check if it's a credit limit error - handle both Error and ProviderApiError
      const errorMessageString =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : String(error);

      if (
        errorMessageString.includes("exceeded your monthly included credits") ||
        errorMessageString.includes("Subscribe to PRO")
      ) {
        errorMessage =
          "You have exceeded your monthly Hugging Face credits. Please upgrade to PRO or wait until your credits reset.";
      }

      // Update the loading message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                text: errorMessage,
              }
            : msg
        )
      );
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Custom components for ReactMarkdown to style the markdown
  const markdownComponents = {
    h1: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <h1 className="text-xl font-bold text-white mt-4 mb-2" {...props} />
    ),
    h2: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <h2 className="text-lg font-bold text-white mt-3 mb-2" {...props} />
    ),
    h3: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <h3 className="text-md font-bold text-white mt-2 mb-1" {...props} />
    ),
    p: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <p className="text-sm mb-2 leading-relaxed" {...props} />
    ),
    ul: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <ul className="list-disc list-inside mb-2 space-y-1" {...props} />
    ),
    ol: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />
    ),
    li: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <li className="text-sm" {...props} />
    ),
    strong: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <strong className="font-bold text-white" {...props} />
    ),
    em: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <em className="italic" {...props} />
    ),
    table: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border border-gray-600" {...props} />
      </div>
    ),
    thead: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <thead className="bg-gray-700" {...props} />
    ),
    tbody: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <tbody {...props} />
    ),
    tr: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <tr className="border-b border-gray-600" {...props} />
    ),
    th: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <th
        className="px-3 py-2 text-left text-xs font-bold text-white border-r border-gray-600 last:border-r-0"
        {...props}
      />
    ),
    td: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <td
        className="px-3 py-2 text-xs border-r border-gray-600 last:border-r-0"
        {...props}
      />
    ),
    code: ({
      node,
      inline,
      ...props
    }: {
      node?: any;
      inline?: boolean;
      [key: string]: any;
    }) =>
      inline ? (
        <code className="bg-gray-700 px-1 py-0.5 rounded text-xs" {...props} />
      ) : (
        <code
          className="block bg-gray-700 p-2 rounded text-xs my-2 overflow-x-auto"
          {...props}
        />
      ),
    blockquote: ({ node, ...props }: { node?: any; [key: string]: any }) => (
      <blockquote
        className="border-l-4 border-blue-500 pl-3 my-2 text-gray-300 italic"
        {...props}
      />
    ),
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Messages Container - Now uses full height */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.isUser ? "justify-end" : "justify-start"
            } w-full`}
          >
            <div
              className={`max-w-full px-4 py-2 rounded-lg ${
                message.isUser
                  ? "bg-blue-600 text-white rounded-br-none border border-blue-500 max-w-2xl"
                  : "bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700 w-full"
              }`}
            >
              {message.isUser ? (
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
              ) : (
                <div className="text-sm prose prose-invert max-w-none">
                  {message.imageUrl ? (
                    <div className="space-y-2">
                      <p>{message.text}</p>
                      <div className="flex justify-center">
                        <img
                          src={message.imageUrl}
                          alt="Generated image"
                          className="max-w-full h-auto rounded-lg border border-gray-600 max-h-96 object-contain"
                        />
                      </div>
                      <div className="flex justify-center">
                        <a
                          href={message.imageUrl}
                          download={`generated-image-${message.id}.png`}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                        >
                          Download Image
                        </a>
                      </div>
                    </div>
                  ) : (
                    <ReactMarkdown components={markdownComponents}>
                      {message.text}
                    </ReactMarkdown>
                  )}
                </div>
              )}
              <p
                className={`text-xs mt-1 ${
                  message.isUser ? "text-blue-200" : "text-gray-500"
                }`}
              >
                {formatTime(message.timestamp)}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start w-full">
            <div className="max-w-full px-4 py-2 rounded-lg bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                <div
                  className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <form
          onSubmit={handleSendMessage}
          className="flex space-x-2 max-w-7xl mx-auto"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              selectedPipeline === "text-to-image"
                ? "Describe the image you want to generate..."
                : "Ask First Search AI anything..."
            }
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
            disabled={isLoading || !isVerified || !selectedModel}
          />
          <div className="relative inline-block group">
            <button
              disabled={
                !isVerified ||
                isLoading ||
                !selectedModel ||
                inputMessage.trim() === ""
              }
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors border border-blue-500 disabled:bg-gray-600 disabled:text-gray-400 disabled:border-gray-500 disabled:cursor-not-allowed"
            >
              {isLoading ? "..." : <RiAiGenerate2 className="w-5 h-5" />}
            </button>
            {!isVerified && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-sm rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200">
                Please verify HuggingFace API key!
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
              </div>
            )}
          </div>
        </form>
        {selectedPipeline &&
          selectedPipeline !== "text-generation" &&
          selectedPipeline !== "text-to-image" && (
            <p className="text-yellow-500 text-xs mt-2 text-center">
              Note: Currently only text generation and text-to-image models are
              fully supported
            </p>
          )}
        {selectedPipeline === "text-to-image" && (
          <p className="text-blue-400 text-xs mt-2 text-center">
            Enter a description of the image you want to generate
          </p>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 py-3 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center sm:justify-between space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2 text-gray-400 text-sm order-2 sm:order-1">
            <span>Made with ❤️ by Johny Bhiduri</span>
          </div>

          <div className="flex items-center space-x-4 order-1 sm:order-2">
            <a
              href="https://github.com/Johnybhiduri/First-Search-AI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors duration-200"
              aria-label="GitHub Repository"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
            </a>

            <a
              href="https://www.linkedin.com/in/jainendra-bhiduri-245054220/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors duration-200"
              aria-label="LinkedIn Profile"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;

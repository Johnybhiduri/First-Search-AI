import React, { useState, useRef, useEffect } from "react";
import { InferenceClient } from "@huggingface/inference";
import ReactMarkdown from "react-markdown";
import { RiAiGenerate2 } from "react-icons/ri";
import { FaGithub, FaLinkedin } from "react-icons/fa";

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
  imageUrl?: string;
  classificationData?: ClassificationResult[];
}

interface ClassificationResult {
  label: string;
  score: number;
}

interface SummarizationResult {
  summary_text: string;
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

    // Check if supported pipelines
    if (
      selectedPipeline !== "text-generation" &&
      selectedPipeline !== "text-to-image" &&
      selectedPipeline !== "text-classification" &&
      selectedPipeline !== "summarization"
    ) {
      const errorMessage: Message = {
        id: messages.length + 2,
        text: "Currently only text generation, text-to-image, text-classification, and summarization models are working. We will add support for other pipelines in upcoming versions.",
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
      } else if (selectedPipeline === "text-classification") {
        await handleTextClassification(inputMessage);
      } else if (selectedPipeline === "summarization") {
        await handleSummarization(inputMessage);
      }
    } catch (error) {
      console.error("Error processing request:", error);

      const errorMessage: Message = {
        id: messages.length + 2,
        text: "Sorry, I encountered an error while processing your request. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== messages.length + 2);
        return [...filtered, errorMessage];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextGeneration = async (userInput: string) => {
    const botMessageId = messages.length + 2;
    const botMessage: Message = {
      id: botMessageId,
      text: "",
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, botMessage]);

    try {
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

      const errorMessageString = getErrorMessage(error);

      if (isCreditLimitError(errorMessageString)) {
        errorMessage =
          "You have exceeded your monthly Hugging Face credits. Please upgrade to PRO or wait until your credits reset.";
      }

      const errorMessageObj: Message = {
        id: botMessageId,
        text: errorMessage,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== botMessageId);
        return [...filtered, errorMessageObj];
      });
    }
  };

  const handleImageGeneration = async (prompt: string) => {
    const loadingMessage: Message = {
      id: messages.length + 2,
      text: `Generating image for: "${prompt}"...`,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const client = new InferenceClient(api_key);

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

      const imageUrl = URL.createObjectURL(imageBlob);

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

      const errorMessageString = getErrorMessage(error);

      if (isCreditLimitError(errorMessageString)) {
        errorMessage =
          "You have exceeded your monthly Hugging Face credits. Please upgrade to PRO or wait until your credits reset.";
      }

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

  const handleTextClassification = async (text: string) => {
    const loadingMessage: Message = {
      id: messages.length + 2,
      text: `Analyzing text classification for: "${text}"...`,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const client = new InferenceClient(api_key);

      const classificationResults = await client.textClassification({
        model: selectedModel as string,
        inputs: text,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                text: `Text classification results for: "${text}"`,
                classificationData: classificationResults,
              }
            : msg
        )
      );
    } catch (error: unknown) {
      console.error("Error performing text classification:", error);

      let errorMessage =
        "Sorry, I encountered an error while analyzing the text. Please try again.";

      const errorMessageString = getErrorMessage(error);

      if (isCreditLimitError(errorMessageString)) {
        errorMessage =
          "You have exceeded your monthly Hugging Face credits. Please upgrade to PRO or wait until your credits reset.";
      }

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

  const handleSummarization = async (text: string) => {
    const loadingMessage: Message = {
      id: messages.length + 2,
      text: `Summarizing text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"...`,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const client = new InferenceClient(api_key);

      const summarizationResult: SummarizationResult = await client.summarization({
        model: selectedModel as string,
        inputs: text,
      });

      // Replace the loading message with the summarization result
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                text: `**Summary:**\n\n${summarizationResult.summary_text}\n\n---\n*Original text: "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"*`,
              }
            : msg
        )
      );
    } catch (error: unknown) {
      console.error("Error performing summarization:", error);

      let errorMessage =
        "Sorry, I encountered an error while summarizing the text. Please try again.";

      const errorMessageString = getErrorMessage(error);

      if (isCreditLimitError(errorMessageString)) {
        errorMessage =
          "You have exceeded your monthly Hugging Face credits. Please upgrade to PRO or wait until your credits reset.";
      }

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

  // Helper function to extract error message
  const getErrorMessage = (error: unknown): string => {
    return error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : String(error);
  };

  // Helper function to check for credit limit errors
  const isCreditLimitError = (errorMessage: string): boolean => {
    return (
      errorMessage.includes("exceeded your monthly included credits") ||
      errorMessage.includes("Subscribe to PRO")
    );
  };

  // Component to render classification results as a bar chart
  const ClassificationChart: React.FC<{ data: ClassificationResult[] }> = ({
    data,
  }) => {
    const sortedData = [...data].sort((a, b) => b.score - a.score);

    return (
      <div className="space-y-3 mt-2">
        <div className="text-sm font-medium text-gray-300">
          Classification Results:
        </div>
        {sortedData.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span className="capitalize">{item.label}</span>
              <span>{(item.score * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-linear-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${item.score * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
        <div className="text-xs text-gray-500 mt-2">
          Highest confidence:{" "}
          <span className="text-green-400 font-medium">
            {sortedData[0]?.label} ({(sortedData[0]?.score * 100).toFixed(1)}%)
          </span>
        </div>
      </div>
    );
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
      {/* Messages Container */}
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
                  ? "bg-blue-800 text-white rounded-br-none border border-blue-800 max-w-2xl"
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
                  ) : message.classificationData ? (
                    <div className="space-y-2">
                      <p>{message.text}</p>
                      <ClassificationChart data={message.classificationData} />
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
                : selectedPipeline === "text-classification"
                ? "Enter text to classify..."
                : selectedPipeline === "summarization"
                ? "Enter text to summarize..."
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
          selectedPipeline !== "text-to-image" &&
          selectedPipeline !== "text-classification" &&
          selectedPipeline !== "summarization" && (
            <p className="text-yellow-500 text-xs mt-2 text-center">
              Note: Currently only text generation, text-to-image, text-classification, and summarization models are fully supported
            </p>
          )}
        {selectedPipeline === "text-to-image" && (
          <p className="text-blue-400 text-xs mt-2 text-center">
            Enter a description of the image you want to generate
          </p>
        )}
        {selectedPipeline === "text-classification" && (
          <p className="text-blue-400 text-xs mt-2 text-center">
            Enter text to analyze its classification (sentiment, topic, etc.)
          </p>
        )}
        {selectedPipeline === "summarization" && (
          <p className="text-blue-400 text-xs mt-2 text-center">
            Enter text to generate a summary
          </p>
        )}
      </div>
          {/* {Footer} */}
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
              <FaGithub className="w-5 h-5" />
            </a>

            <a
              href="https://www.linkedin.com/in/jainendra-bhiduri-245054220/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors duration-200"
              aria-label="LinkedIn Profile"
            >
              <FaLinkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;



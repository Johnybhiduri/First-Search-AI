import React, { useState, useRef, useEffect } from "react";
import { InferenceClient } from "@huggingface/inference";
import ReactMarkdown from "react-markdown";
import { RiAiGenerate2 } from "react-icons/ri";
import {
  FaGithub,
  FaLinkedin,
  FaPlus,
  FaTimes,
  FaVolumeUp,
  FaDownload,
  FaRegCopy,
  FaCheck,
} from "react-icons/fa";

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
  imageUrl?: string;
  classificationData?: ClassificationResult[];
  imageClassificationData?: ImageClassificationResult[];
  audioUrl?: string;
}

interface ClassificationResult {
  label: string;
  score: number;
}

interface ImageClassificationResult {
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = async (text: string, id: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clean up image preview URLs
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      // Clean up audio URLs
      messages.forEach((message) => {
        if (message.audioUrl) {
          URL.revokeObjectURL(message.audioUrl);
        }
      });
    };
  }, [imagePreview, messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    // For image classification, require an image instead of text input
    if (selectedPipeline === "image-classification") {
      if (!selectedImage) {
        const errorMessage: Message = {
          id: messages.length + 1,
          text: "Please select an image for classification.",
          isUser: false,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }
      await handleImageClassification(selectedImage);
      return;
    }

    // For other pipelines, require text input
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
      selectedPipeline !== "summarization" &&
      selectedPipeline !== "image-classification" &&
      selectedPipeline !== "text-to-speech"
    ) {
      const errorMessage: Message = {
        id: messages.length + 2,
        text: "Currently only text generation, text-to-image, text-classification, image-classification, text-to-speech and summarization models are working. We will add support for other pipelines in upcoming versions.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setInputMessage("");
      return;
    }

    // Add user message for text-based pipelines
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
      } else if (selectedPipeline === "text-to-speech") {
        await handleTextToSpeech(inputMessage);
      }
    } catch (error) {
      console.error("Error processing request:", error);
      handleError(
        "Sorry, I encountered an error while processing your request. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextToSpeech = async (text: string) => {
    const loadingMessage: Message = {
      id: messages.length + 2,
      text: `Generating speech for: "${text.substring(0, 100)}${
        text.length > 100 ? "..." : ""
      }"...`,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const client = new InferenceClient(api_key);

      // Determine provider based on model
      const provider = selectedModel?.includes("hexgrad/Kokoro-82M")
        ? "replicate"
        : "auto";

      const audioBlob = await client.textToSpeech({
        model: selectedModel as string,
        inputs: text,
        provider: provider as any,
      });

      const audioUrl = URL.createObjectURL(audioBlob);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                text: `Generated speech for: "${text.substring(0, 100)}${
                  text.length > 100 ? "..." : ""
                }"`,
                audioUrl: audioUrl,
              }
            : msg
        )
      );
    } catch (error: unknown) {
      console.error("Error generating speech:", error);
      handlePipelineError(error, loadingMessage.id, "generating speech");
    }
  };

  const handleImageClassification = async (imageFile: File) => {
    if (!isVerified || !selectedModel) return;

    // Create user message with image preview
    const userMessage: Message = {
      id: messages.length + 1,
      text: "Image uploaded for classification",
      isUser: true,
      timestamp: new Date(),
      imageUrl: imagePreview || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const loadingMessage: Message = {
      id: messages.length + 2,
      text: "Analyzing image...",
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const client = new InferenceClient(api_key);

      // Convert File to Blob (the correct type for imageClassification)
      const imageBlob = new Blob([imageFile], { type: imageFile.type });

      const imageClassificationResults = await client.imageClassification({
        data: imageBlob,
        model: selectedModel,
      });

      // Replace loading message with results
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                text: "Image classification completed",
                imageClassificationData: imageClassificationResults,
              }
            : msg
        )
      );

      // Clear selected image after successful classification
      clearSelectedImage();
    } catch (error: unknown) {
      console.error("Error performing image classification:", error);

      let errorMessage =
        "Sorry, I encountered an error while analyzing the image. Please try again.";
      const errorMessageString = getErrorMessage(error);

      if (isCreditLimitError(errorMessageString)) {
        errorMessage =
          "You have exceeded your monthly Hugging Face credits. Please upgrade to PRO or wait until your credits reset.";
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id ? { ...msg, text: errorMessage } : msg
        )
      );
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
      handleStreamingError(error, botMessageId);
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
      handlePipelineError(error, loadingMessage.id, "generating the image");
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
      handlePipelineError(error, loadingMessage.id, "analyzing the text");
    }
  };

  const handleSummarization = async (text: string) => {
    const loadingMessage: Message = {
      id: messages.length + 2,
      text: `Summarizing text: "${text.substring(0, 100)}${
        text.length > 100 ? "..." : ""
      }"...`,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      const client = new InferenceClient(api_key);

      const summarizationResult: SummarizationResult =
        await client.summarization({
          model: selectedModel as string,
          inputs: text,
        });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                text: `**Summary:**\n\n${
                  summarizationResult.summary_text
                }\n\n---\n*Original text: "${text.substring(0, 150)}${
                  text.length > 150 ? "..." : ""
                }"*`,
              }
            : msg
        )
      );
    } catch (error: unknown) {
      console.error("Error performing summarization:", error);
      handlePipelineError(error, loadingMessage.id, "summarizing the text");
    }
  };

  // Image handling functions
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      const errorMessage: Message = {
        id: messages.length + 1,
        text: "Please select a valid image file (JPEG, PNG, etc.).",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    // Clean up previous preview
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearSelectedImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Handle key down for Shift + Enter
  // Handle key down for Shift + Enter and form submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey) {
      // Shift + Enter: Insert new line
      e.preventDefault();
      const cursorPosition = e.currentTarget.selectionStart;
      const textBefore = inputMessage.substring(0, cursorPosition);
      const textAfter = inputMessage.substring(cursorPosition);

      setInputMessage(textBefore + "\n" + textAfter);

      // Set cursor position after the new line
      setTimeout(() => {
        e.currentTarget.selectionStart = cursorPosition + 1;
        e.currentTarget.selectionEnd = cursorPosition + 1;
      }, 0);
    } else if (e.key === "Enter" && !e.shiftKey) {
      // Enter alone: Submit form
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Add this useEffect to auto-resize the textarea
  useEffect(() => {
    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [inputMessage]);

  // Audio playback function
  const playAudio = (audioUrl: string) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  };

  // Error handling helper functions
  const handleError = (message: string) => {
    const errorMessage: Message = {
      id: messages.length + 2,
      text: message,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages((prev) => {
      const filtered = prev.filter((msg) => msg.id !== messages.length + 2);
      return [...filtered, errorMessage];
    });
  };

  const handleStreamingError = (error: unknown, botMessageId: number) => {
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
  };

  const handlePipelineError = (
    error: unknown,
    messageId: number,
    action: string
  ) => {
    let errorMessage = `Sorry, I encountered an error while ${action}. Please try again.`;
    const errorMessageString = getErrorMessage(error);

    if (isCreditLimitError(errorMessageString)) {
      errorMessage =
        "You have exceeded your monthly Hugging Face credits. Please upgrade to PRO or wait until your credits reset.";
    } else if (
      errorMessageString.includes("text-to-speech") ||
      errorMessageString.includes("speech")
    ) {
      // Extract relevant part of error message for text-to-speech
      const relevantError =
        errorMessageString.split("\n")[0] || errorMessageString;
      errorMessage = `Text-to-speech error: ${relevantError.substring(0, 100)}${
        relevantError.length > 100 ? "..." : ""
      }`;
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, text: errorMessage } : msg
      )
    );
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

  // Component to render image classification results
  const ImageClassificationChart: React.FC<{
    data: ImageClassificationResult[];
  }> = ({ data }) => {
    const sortedData = [...data].sort((a, b) => b.score - a.score);

    return (
      <div className="space-y-3 mt-2">
        <div className="text-sm font-medium text-gray-300">
          Image Classification Results:
        </div>
        {sortedData.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span className="capitalize">{item.label}</span>
              <span>{(item.score * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-linear-to-r from-green-500 to-teal-600 h-2.5 rounded-full transition-all duration-500 ease-out"
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

  // Component to render audio player
  const AudioPlayer: React.FC<{ audioUrl: string; messageId: number }> = ({
    audioUrl,
    messageId,
  }) => {
    return (
      <div className="space-y-2 mt-2">
        <div className="text-sm font-medium text-gray-300">
          Generated Speech:
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => playAudio(audioUrl)}
            className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FaVolumeUp className="w-4 h-4" />
            <span>Play</span>
          </button>
          <a
            href={audioUrl}
            download={`generated-speech-${messageId}.wav`}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaDownload className="w-4 h-4" />
            <span>Download</span>
          </a>
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
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} className="hidden" />

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
              className={`relative max-w-full px-4 py-2 pr-10 rounded-lg ${
                message.isUser
                  ? "bg-blue-800 text-white rounded-br-none border border-blue-800 max-w-2xl"
                  : "bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700 w-full"
              }`}
            >
              {message.isUser ? (
                <div className="space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>

                  {selectedPipeline !== null &&
                    ["text-generation", "summarization"].includes(
                      selectedPipeline
                    ) && (
                      <button
                        onClick={() => handleCopy(message.text, message.id)}
                        className="absolute bottom-1 right-1 text-blue-200 hover:text-white"
                      >
                        {copiedId === message.id ? (
                          <FaCheck className="w-4 h-4 text-green-400" />
                        ) : (
                          <FaRegCopy className="w-4 h-4" />
                        )}
                      </button>
                    )}

                  {message.imageUrl && (
                    <div className="flex justify-center">
                      <img
                        src={message.imageUrl}
                        alt="Uploaded for classification"
                        className="max-w-full h-auto rounded-lg border border-gray-600 max-h-48 object-contain"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative text-sm prose prose-invert max-w-none">
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
                  ) : message.imageClassificationData ? (
                    <div className="space-y-2">
                      <p>{message.text}</p>
                      <ImageClassificationChart
                        data={message.imageClassificationData}
                      />
                    </div>
                  ) : message.audioUrl ? (
                    <div className="space-y-2">
                      <p>{message.text}</p>
                      <AudioPlayer
                        audioUrl={message.audioUrl}
                        messageId={message.id}
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <ReactMarkdown components={markdownComponents}>
                        {message.text}
                      </ReactMarkdown>

                      {selectedPipeline !== null &&
                        ["text-generation", "summarization"].includes(
                          selectedPipeline
                        ) && (
                          <button
                            onClick={() => handleCopy(message.text, message.id)}
                            className="absolute bottom-0 right-0 text-gray-400 hover:text-white z-10 p-1 bg-gray-800 rounded"
                          >
                            {copiedId === message.id ? (
                              <FaCheck className="w-4 h-4 text-green-400" />
                            ) : (
                              <FaRegCopy className="w-4 h-4" />
                            )}
                          </button>
                        )}
                    </div>
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
        {/* Hidden file input for image selection */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />

        <form
          onSubmit={handleSendMessage}
          className="flex space-x-2 max-w-7xl mx-auto"
        >
          {/* Image upload area for image classification */}
          {selectedPipeline === "image-classification" ? (
            <div className="flex-1 flex items-center space-x-2">
              {selectedImage ? (
                <div className="flex items-center space-x-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 flex-1">
                  <div className="flex items-center space-x-2 flex-1">
                    <img
                      src={imagePreview || ""}
                      alt="Selected"
                      className="w-8 h-8 object-cover rounded"
                    />
                    <span className="text-white text-sm truncate">
                      {selectedImage.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedImage}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <FaTimes className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors text-white flex items-center justify-center space-x-2"
                >
                  <FaPlus className="w-4 h-4" />
                  <span>Select Image</span>
                </button>
              )}
            </div>
          ) : (
            // Regular text input for other pipelines
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedPipeline === "text-to-image"
                  ? "Describe the image you want to generate... (Shift+Enter for new line)"
                  : selectedPipeline === "text-classification"
                  ? "Enter text to classify... (Shift+Enter for new line)"
                  : selectedPipeline === "summarization"
                  ? "Enter text to summarize... (Shift+Enter for new line)"
                  : selectedPipeline === "text-to-speech"
                  ? "Enter text to convert to speech... (Shift+Enter for new line)"
                  : "Ask First Search AI anything... (Shift+Enter for new line)"
              }
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 resize-none"
              disabled={isLoading || !isVerified || !selectedModel}
              rows={1}
              style={{ minHeight: "42px", maxHeight: "120px" }}
            />
          )}

          <div className="relative inline-block group">
            <button
              disabled={
                !isVerified ||
                isLoading ||
                !selectedModel ||
                (selectedPipeline === "image-classification"
                  ? !selectedImage
                  : inputMessage.trim() === "")
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

        {/* Pipeline-specific instructions */}
        {selectedPipeline &&
          selectedPipeline !== "text-generation" &&
          selectedPipeline !== "text-to-image" &&
          selectedPipeline !== "text-classification" &&
          selectedPipeline !== "summarization" &&
          selectedPipeline !== "image-classification" &&
          selectedPipeline !== "text-to-speech" && (
            <p className="text-yellow-500 text-xs mt-2 text-center">
              Note: Currently only text generation, text-to-image,
              text-classification, image-classification, text-to-speech and
              summarization models are fully supported
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
        {selectedPipeline === "image-classification" && (
          <p className="text-blue-400 text-xs mt-2 text-center">
            Select an image to analyze its content
          </p>
        )}
        {selectedPipeline === "text-to-speech" && (
          <p className="text-blue-400 text-xs mt-2 text-center">
            Enter text to convert to speech (use Shift+Enter for new lines)
          </p>
        )}
      </div>
      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 py-3 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center sm:justify-between space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2 text-gray-400 text-sm order-2 sm:order-1">
            <span>
              Made with ❤️ by{" "}
              <span className="font-bold">
                <a
                  href="https://www.linkedin.com/in/jainendra-bhiduri-245054220/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                  aria-label="LinkedIn Profile"
                >
                  J. Bhiduri
                </a>
              </span>
            </span>
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

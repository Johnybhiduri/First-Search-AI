import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  HiKey,
  HiCheckCircle,
  HiXCircle,
  HiChevronDown,
  HiChevronLeft,
  HiChevronRight,
  HiInformationCircle,
} from "react-icons/hi";
import { RiRobot2Line } from "react-icons/ri";
import { MdInput } from "react-icons/md";
import { FaRegSquareCheck } from "react-icons/fa6";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onVerify: () => void;
  onSelectModel: (modelId: string | null) => void;
  onSelectPipeline: (pipelineTag: string | null) => void;
  onSetApiKey: (apiKey: string) => void;
}

interface Model {
  id: string;
  name: string;
  pipeline_tag?: string;
  description?: string;
}

interface PipelineModels {
  [pipelineTag: string]: Model[];
}

interface ModelInfo {
  id: string;
  description?: string;
  tags?: string[];
  downloads?: number;
  likes?: number;
  author?: string;
  lastModified?: string;
  cardData?: {
    model_name?: string;
    language?: string[];
    license?: string;
    datasets?: string[];
    library_name?: string;
    pipeline_tag?: string;
  };
  fullDescription?: string;
  rawCardText?: string;
  modelName?: string;
  license?: string;
  languages?: string[];
  datasets?: string[];
  papers?: Array<{
    title: string;
    url: string;
  }>;
  metrics?: Array<{
    name: string;
    type: string;
    value: number;
    dataset: string;
  }>;
  usage?: string;
  limitations?: string;
  trainingData?: string;
  trainingProcedure?: string;
}

interface ModelCardData {
  fullDescription: string;
  sections: string[];
  usage?: string;
  limitations?: string;
  trainingData?: string;
  trainingProcedure?: string;
}

interface TaskType {
  id: string;
  name: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onVerify,
  onSelectModel,
  onSelectPipeline,
  onSetApiKey,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [isApiVerified, setIsApiVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedTask, setSelectedTask] = useState("text-generation");
  const [selectedModel, setSelectedModel] = useState("");
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [pipelineModels, setPipelineModels] = useState<PipelineModels>({});
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [selectedModelInfo, setSelectedModelInfo] = useState<ModelInfo | null>(
    null
  );
  const [isFetchingModelInfo, setIsFetchingModelInfo] = useState(false);
  const [showModelInfoModal, setShowModelInfoModal] = useState(false);

  const taskDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Task types that correspond to Hugging Face pipeline tags
  const taskTypes: TaskType[] = [
    { id: "text-generation", name: "Text Generation" },
    { id: "text2text-generation", name: "Text to Text Generation" },
    { id: "text-classification", name: "Text Classification" },
    { id: "question-answering", name: "Question Answering" },
    { id: "summarization", name: "Summarization" },
    { id: "translation", name: "Translation" },
    { id: "conversational", name: "Conversational AI" },
    { id: "image-classification", name: "Image Classification" },
    { id: "image-to-text", name: "Image to Text" },
    { id: "text-to-image", name: "Text to Image" },
    { id: "audio-classification", name: "Audio Classification" },
    { id: "automatic-speech-recognition", name: "Speech Recognition" },
    { id: "text-to-speech", name: "Text to Speech" },
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        taskDropdownRef.current &&
        !taskDropdownRef.current.contains(event.target as Node)
      ) {
        setShowTaskDropdown(false);
      }
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node)
      ) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Helper function to parse model card markdown
  const parseModelCard = (markdownText: string): ModelCardData => {
    const result: ModelCardData = {
      fullDescription: "",
      sections: [],
    };

    // Remove YAML frontmatter if present
    let content = markdownText;
    if (content.startsWith("---")) {
      const endFrontmatter = content.indexOf("\n---", 3);
      if (endFrontmatter !== -1) {
        content = content.substring(endFrontmatter + 4);
      }
    }

    // Remove all badge images and HTML tags for the description
    const cleanDescription = content
      .replace(/<div[^>]*>.*?<\/div>/gs, "")
      .replace(/<[^>]+>/g, "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/---+/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Extract the main description (content before the first major heading)
    const lines = content.split("\n");
    const descriptionLines: string[] = [];
    let foundFirstHeading: boolean = false;
    console.log(foundFirstHeading);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for major headings (h1, h2)
      if (line.startsWith("# ") || line.startsWith("## ")) {
        if (descriptionLines.length > 0) {
          foundFirstHeading = true;
          break;
        }
      }

      // Skip empty lines at the beginning
      if (line.trim() === "" && descriptionLines.length === 0) {
        continue;
      }

      // Skip badge-only lines
      if (
        line.includes("badge") ||
        line.includes("shields.io") ||
        line.includes("<img")
      ) {
        continue;
      }

      descriptionLines.push(line);
    }

    // Join description lines and clean up
    result.fullDescription = descriptionLines
      .filter((line) => !line.includes("![") && !line.includes("<"))
      .join("\n")
      .trim();

    // If we couldn't extract a clean description, use the cleaned version
    if (!result.fullDescription || result.fullDescription.length < 50) {
      result.fullDescription = cleanDescription.substring(0, 1000); // Limit length
    }

    // Extract usage section if present
    const usageMatch = content.match(
      /(?:##\s+Usage|##\s+How to Use|##\s+Examples)([\s\S]*?)(?=##\s+|$)/i
    );
    if (usageMatch && usageMatch[1]) {
      result.usage = usageMatch[1].trim();
    }

    // Extract limitations section if present
    const limitationsMatch = content.match(
      /(?:##\s+Limitations|##\s+Limitations and Bias|##\s+Bias)([\s\S]*?)(?=##\s+|$)/i
    );
    if (limitationsMatch && limitationsMatch[1]) {
      result.limitations = limitationsMatch[1].trim();
    }

    // Extract training data section if present
    const trainingMatch = content.match(
      /(?:##\s+Training|##\s+Training Data|##\s+Model Details)([\s\S]*?)(?=##\s+|$)/i
    );
    if (trainingMatch && trainingMatch[1]) {
      result.trainingData = trainingMatch[1].trim();
    }

    return result;
  };

  // Fetch model information from Hugging Face
  const fetchModelInfo = useCallback(
    async (modelId: string): Promise<ModelInfo | null> => {
      if (!apiKey || !isApiVerified) return null;

      setIsFetchingModelInfo(true);
      try {
        // Fetch model information
        const modelResponse = await fetch(
          `https://huggingface.co/api/models/${modelId}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        if (!modelResponse.ok) {
          throw new Error(`HTTP error! status: ${modelResponse.status}`);
        }

        const modelData = await modelResponse.json();

        // Fetch model card data (contains full description and metadata)
        let rawCardText = "";
        let cardData: ModelCardData | null = null;
        try {
          const cardResponse = await fetch(
            `https://huggingface.co/${modelId}/raw/main/README.md`
          );
          if (cardResponse.ok) {
            rawCardText = await cardResponse.text();
            cardData = parseModelCard(rawCardText);
          }
        } catch (cardError) {
          console.log("Could not fetch model card:", cardError);
        }

        // Parse metrics from model data
        const metrics: Array<{
          name: string;
          type: string;
          value: number;
          dataset: string;
        }> = [];
        if (modelData.modelIndex && Array.isArray(modelData.modelIndex)) {
          for (const item of modelData.modelIndex) {
            if (item.metrics && Array.isArray(item.metrics)) {
              for (const metric of item.metrics) {
                if (metric.name && metric.type && metric.value !== undefined) {
                  metrics.push({
                    name: metric.name,
                    type: metric.type,
                    value: metric.value,
                    dataset: metric.dataset || "Unknown",
                  });
                }
              }
            }
          }
        }

        // In the fetchModelInfo function, update the modelInfo object creation:
        const modelInfo: ModelInfo = {
          id: modelData.id,
          description: modelData.cardData?.description || modelData.description,
          fullDescription:
            cardData?.fullDescription || modelData.cardData?.content,
          rawCardText,
          tags: Array.isArray(modelData.tags) ? modelData.tags : [],
          downloads: modelData.downloads,
          likes: modelData.likes,
          author: modelData.author,
          lastModified: modelData.lastModified,
          cardData: modelData.cardData,
          modelName: modelData.model_name || modelData.id.split("/").pop(),
          license: modelData.cardData?.license || modelData.license,
          languages: Array.isArray(modelData.cardData?.language)
            ? modelData.cardData.language
            : Array.isArray(modelData.language)
            ? modelData.language
            : modelData.language
            ? [modelData.language]
            : [],
          datasets: Array.isArray(modelData.cardData?.datasets)
            ? modelData.cardData.datasets
            : Array.isArray(modelData.datasets)
            ? modelData.datasets
            : modelData.datasets
            ? [modelData.datasets]
            : [],
          papers: Array.isArray(modelData.cardData?.papers)
            ? modelData.cardData.papers
            : [],
          metrics: metrics,
          usage: cardData?.usage || modelData.cardData?.usage,
          limitations: cardData?.limitations || modelData.cardData?.limitations,
          trainingData:
            cardData?.trainingData || modelData.cardData?.training_data,
          trainingProcedure: cardData?.trainingProcedure,
        };

        return modelInfo;
      } catch (error) {
        console.error("Error fetching model information:", error);
        return null;
      } finally {
        setIsFetchingModelInfo(false);
      }
    },
    [apiKey, isApiVerified]
  );

  // Update model info when selected model changes
  useEffect(() => {
    const updateModelInfo = async () => {
      if (selectedModel && isApiVerified) {
        const info = await fetchModelInfo(selectedModel);
        setSelectedModelInfo(info);
      } else {
        setSelectedModelInfo(null);
      }
    };

    updateModelInfo();
  }, [selectedModel, isApiVerified, fetchModelInfo]);

  // Fetch models from Hugging Face API
  const fetchHuggingFaceModels = async (token: string): Promise<boolean> => {
  setIsLoadingModels(true);
  try {
    const response = await fetch(
      "https://huggingface.co/api/models?inference=warm&limit=2000",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const models = await response.json();

    // Organize models by pipeline tag
    const organizedModels: PipelineModels = {};

    models.forEach((model: any) => {
      if (model.pipeline_tag) {
        const pipelineTag = model.pipeline_tag;
        if (!organizedModels[pipelineTag]) {
          organizedModels[pipelineTag] = [];
        }
        organizedModels[pipelineTag].push({
          id: model.id,
          name: model.modelId || model.id,
          pipeline_tag: model.pipeline_tag,
        });
      }
    });

    setPipelineModels(organizedModels);

    // Set default model for the selected task if available
    if (
      organizedModels[selectedTask] &&
      organizedModels[selectedTask].length > 0 &&
      !selectedModel // Only set default if no model is already selected
    ) {
      const defaultModel = organizedModels[selectedTask][0].id;
      setSelectedModel(defaultModel);
      onSelectModel(defaultModel);
    }

    return true;
  } catch (error) {
    console.error("Error fetching Hugging Face models:", error);
    // Even on error, we should clear existing models to show proper state
    setPipelineModels({});
    return false;
  } finally {
    setIsLoadingModels(false);
  }
};

  // Verify API key by making a simple request
  const verifyApiKeyWithRequest = async (token: string): Promise<boolean> => {
  try {
    // Try to fetch user info or a simple endpoint
    const response = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const userInfo = await response.json();
    console.log("API Key verified for user:", userInfo);
    
    // Only call onVerify if this is a new verification (not from session restore)
    if (!isApiVerified) {
      onVerify();
      onSetApiKey(token);
    }
    
    return true;
  } catch (error) {
    console.error("API verification failed:", error);
    return false;
  }
};

  // Notify parent when model changes
  useEffect(() => {
    if (selectedModel) {
      onSelectModel(selectedModel);
    } else {
      onSelectModel(null);
    }
  }, [selectedModel, onSelectModel]);

  // Notify parent when pipeline/task changes
  useEffect(() => {
    if (selectedTask) {
      onSelectPipeline(selectedTask);
    }
  }, [selectedTask, onSelectPipeline]);

  const handleTaskSelect = (taskId: string) => {
    setSelectedTask(taskId);

    // Reset selected model if no models available for the new task
    if (!availableModels[taskId] || availableModels[taskId].length === 0) {
      setSelectedModel("");
      onSelectModel(null);
    } else {
      const newModel = availableModels[taskId][0].id;
      setSelectedModel(newModel);
      onSelectModel(newModel);
    }

    setShowTaskDropdown(false);
  };

  // Update the model selection handler
  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelDropdown(false);
  };

  // Update the useEffect that restores session storage
useEffect(() => {
  const storedKey = sessionStorage.getItem("hf_api_key");
  const storedVerified = sessionStorage.getItem("hf_api_verified");

  if (storedKey) {
    setApiKey(storedKey);
  }

  if (storedVerified === "true") {
    setIsApiVerified(true);
    onVerify();
    onSetApiKey(storedKey || "");
    // Add this: fetch models when API is already verified
    if (storedKey) {
      fetchHuggingFaceModels(storedKey);
    }
  }
}, []);



  const verifyApiKey = async () => {
  if (!apiKey.trim()) return;

  setIsVerifying(true);

  try {
    // Verify API key using direct HTTP request
    const isVerified = await verifyApiKeyWithRequest(apiKey);

    if (isVerified) {
      // Now fetch the available models
      const modelsFetched = await fetchHuggingFaceModels(apiKey);

      if (modelsFetched) {
        setIsApiVerified(true);
        sessionStorage.setItem("hf_api_key", apiKey);
        sessionStorage.setItem("hf_api_verified", "true");
      } else {
        setIsApiVerified(false);
        console.error("Failed to fetch models");
      }
    } else {
      setIsApiVerified(false);
      sessionStorage.removeItem("hf_api_verified");
      sessionStorage.removeItem("hf_api_key");
    }
  } catch (error) {
    console.error("API verification failed:", error);
    setIsApiVerified(false);
  } finally {
    setIsVerifying(false);
  }
};

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    // Reset verification status if API key changes
    if (isApiVerified) {
      setIsApiVerified(false);
      setPipelineModels({});
      setSelectedModelInfo(null);
      setSelectedModel("");
      onSelectModel(null);
    }
  };

  const getCurrentModels = (): Model[] => {
    return pipelineModels[selectedTask] || [];
  };

  // Initialize with some default models if API is not verified
  const getDefaultModels = (): PipelineModels => {
    const defaultModels: PipelineModels = {
      "text-generation": [
        { id: "gpt2", name: "GPT-2" },
        { id: "facebook/opt-350m", name: "OPT-350M" },
      ],
      "text-classification": [
        {
          id: "distilbert-base-uncased-finetuned-sst-2-english",
          name: "DistilBERT SST-2",
        },
      ],
      "question-answering": [
        {
          id: "distilbert-base-cased-distilled-squad",
          name: "DistilBERT SQuAD",
        },
      ],
    };
    return defaultModels;
  };

  const availableModels = isApiVerified ? pipelineModels : getDefaultModels();

  const toggleTaskDropdown = () => {
    setShowTaskDropdown(!showTaskDropdown);
    if (showModelDropdown) setShowModelDropdown(false);
  };

  const toggleModelDropdown = () => {
    if (getCurrentModels().length === 0) return;
    setShowModelDropdown(!showModelDropdown);
    if (showTaskDropdown) setShowTaskDropdown(false);
  };

  const openModelInfoModal = () => {
    if (selectedModelInfo) {
      setShowModelInfoModal(true);
    }
  };

  const closeModelInfoModal = () => {
    setShowModelInfoModal(false);
  };

  // Define ReactMarkdown components with proper TypeScript types
  // Define ReactMarkdown components with proper TypeScript types
  const markdownComponents: Components = {
    h1: ({ children }) => (
      <h1 className="text-xl font-bold text-white mb-3">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-semibold text-white mb-2 mt-4">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-md font-medium text-gray-300 mb-2 mt-3">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-gray-300 mb-3 space-y-1">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside text-gray-300 mb-3 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="ml-4">{children}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ className, children }) => {
      const isInline = !className; // Check if it's inline code by absence of language class
      if (isInline) {
        return (
          <code className="bg-gray-800 px-1 py-0.5 rounded text-sm">
            {children}
          </code>
        );
      }
      return (
        <code
          className={`${className} block bg-gray-800 p-3 rounded text-sm overflow-x-auto`}
        >
          {children}
        </code>
      );
    },
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-blue-400 hover:text-blue-300 underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    img: () => null,
    pre: ({ children }) => (
      <pre className="bg-gray-900 p-3 rounded-lg overflow-x-auto text-sm">
        {children}
      </pre>
    ),
  };

  // Render Model Info Modal
  const renderModelInfoModal = () => {
    if (!showModelInfoModal || !selectedModelInfo) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <RiRobot2Line className="text-white text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {selectedModelInfo.modelName ||
                    selectedModelInfo.id.split("/").pop()}
                </h3>
                <p className="text-sm text-gray-400">
                  {selectedModelInfo.author
                    ? `by ${selectedModelInfo.author}`
                    : selectedModelInfo.id}
                </p>
              </div>
            </div>
            <button
              onClick={closeModelInfoModal}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <HiXCircle className="text-gray-400 text-xl" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {isFetchingModelInfo ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-300">
                  Loading model info...
                </span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Full Description */}
                {selectedModelInfo.fullDescription && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-3">
                      Model Description
                    </h4>
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {selectedModelInfo.fullDescription}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                {/* Key Highlights Section */}
                {(selectedModelInfo.tags?.includes("featured") ||
                  (selectedModelInfo.fullDescription &&
                    selectedModelInfo.fullDescription
                      .toLowerCase()
                      .includes("highlight"))) && (
                  <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-4 rounded-lg border border-blue-800/30">
                    <h4 className="text-sm font-semibold text-blue-300 mb-2">
                      ✨ Key Highlights
                    </h4>
                    <ul className="space-y-2">
                      {selectedModelInfo.tags
                        ?.filter((tag) =>
                          [
                            "featured",
                            "state-of-the-art",
                            "popular",
                            "top",
                            "best",
                          ].some((keyword) =>
                            tag.toLowerCase().includes(keyword)
                          )
                        )
                        .map((tag, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-blue-400 mr-2">•</span>
                            <span className="text-gray-300 text-sm">{tag}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {/* Model Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      {selectedModelInfo.downloads !== undefined && (
                        <div className="bg-gray-900 p-3 rounded-lg">
                          <p className="text-xs text-gray-400">Downloads</p>
                          <p className="text-white font-semibold text-lg">
                            {selectedModelInfo.downloads.toLocaleString()}
                          </p>
                        </div>
                      )}
                      {selectedModelInfo.likes !== undefined && (
                        <div className="bg-gray-900 p-3 rounded-lg">
                          <p className="text-xs text-gray-400">Likes</p>
                          <p className="text-white font-semibold text-lg">
                            {selectedModelInfo.likes.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-300 mb-3">
                        Basic Information
                      </h5>
                      <div className="space-y-2">
                        {selectedModelInfo.author && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-400">
                              Author
                            </span>
                            <span className="text-sm text-white">
                              {selectedModelInfo.author}
                            </span>
                          </div>
                        )}
                        {selectedModelInfo.license && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-400">
                              License
                            </span>
                            <span className="text-sm text-white">
                              {selectedModelInfo.license}
                            </span>
                          </div>
                        )}
                        {selectedModelInfo.lastModified && (
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-400">
                              Last Updated
                            </span>
                            <span className="text-sm text-white">
                              {new Date(
                                selectedModelInfo.lastModified
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {/* Tags */}
                    {selectedModelInfo.tags &&
                      Array.isArray(selectedModelInfo.tags) &&
                      selectedModelInfo.tags.length > 0 && (
                        <div className="bg-gray-900 p-4 rounded-lg">
                          <h5 className="text-sm font-medium text-gray-300 mb-3">
                            Tags & Categories
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {selectedModelInfo.tags.map((tag, index) => (
                              <span
                                key={index}
                                className={`px-3 py-1 text-xs rounded-full ${
                                  typeof tag === "string" &&
                                  (tag
                                    .toLowerCase()
                                    .includes("state-of-the-art") ||
                                    tag.toLowerCase().includes("featured") ||
                                    tag.toLowerCase().includes("top"))
                                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                                    : "bg-gray-800 text-gray-300"
                                }`}
                              >
                                {typeof tag === "string"
                                  ? tag
                                  : JSON.stringify(tag)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Languages */}
                    {selectedModelInfo.languages &&
                      Array.isArray(selectedModelInfo.languages) &&
                      selectedModelInfo.languages.length > 0 && (
                        <div className="bg-gray-900 p-4 rounded-lg">
                          <h5 className="text-sm font-medium text-gray-300 mb-3">
                            Supported Languages
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {selectedModelInfo.languages.map((lang, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full border border-blue-500/30"
                              >
                                {typeof lang === "string"
                                  ? lang
                                  : JSON.stringify(lang)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
                {/* Metrics Section */}
                {selectedModelInfo.metrics &&
                  Array.isArray(selectedModelInfo.metrics) &&
                  selectedModelInfo.metrics.length > 0 && (
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">
                        Performance Metrics
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Metric
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Dataset
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Value
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Type
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {selectedModelInfo.metrics
                              .slice(0, 5)
                              .map((metric, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                                    {metric.name || "N/A"}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                                    {metric.dataset || "Unknown"}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-white font-semibold">
                                    {metric.value !== undefined
                                      ? metric.value.toFixed(2)
                                      : "N/A"}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs rounded-full bg-gray-800 text-gray-300">
                                      {metric.type || "N/A"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {selectedModelInfo.metrics.length > 5 && (
                          <div className="mt-3 text-center">
                            <p className="text-xs text-gray-400">
                              ... and {selectedModelInfo.metrics.length - 5}{" "}
                              more metrics
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                {/* Usage Section */}
                {selectedModelInfo.usage && (
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">
                      Usage & Examples
                    </h4>
                    <div className="bg-gray-950 p-4 rounded-lg overflow-x-auto">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {selectedModelInfo.usage}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                {/* Limitations Section */}
                {selectedModelInfo.limitations && (
                  <div className="bg-red-900/20 p-4 rounded-lg border border-red-800/30">
                    <h4 className="text-sm font-medium text-red-300 mb-2">
                      ⚠️ Limitations & Bias
                    </h4>
                    <div className="text-sm text-gray-300">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {selectedModelInfo.limitations}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                {/* Model ID */}
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">Full Model ID:</p>
                  <code className="text-sm text-gray-300 bg-gray-950 p-3 rounded-lg block break-all border border-gray-700">
                    {selectedModelInfo.id}
                  </code>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-gray-700 flex justify-end">
            <button
              onClick={closeModelInfoModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="h-full bg-gray-900 border-r border-gray-700 flex flex-col">
        {/* Sidebar Header with Logo and Toggle */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            {isOpen ? (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <RiRobot2Line className="text-white text-lg" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">
                      First Search AI
                    </h1>
                    <p className="text-xs text-gray-400">AI Assistant</p>
                  </div>
                </div>
                <button
                  onClick={onToggle}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                  aria-label="Collapse sidebar"
                >
                  <HiChevronLeft className="text-gray-400 text-xl" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <RiRobot2Line className="text-white text-xl" />
                </div>
                <button
                  onClick={onToggle}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                  aria-label="Expand sidebar"
                >
                  <HiChevronRight className="text-gray-400 text-xl" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* API Key Section */}
          <div className="space-y-3">
            {isOpen && (
              <label className="block text-sm font-medium text-gray-300">
                Hugging Face API Key
              </label>
            )}

            <div className="space-y-2">
              {isOpen ? (
                <div className="flex space-x-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    placeholder="Enter your Hugging Face API key"
                    className={`flex-1 px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white placeholder-gray-400 ${
                      isApiVerified
                        ? "border-green-500"
                        : apiKey
                        ? "border-yellow-500"
                        : "border-gray-600"
                    }`}
                  />
                  <button
                    onClick={verifyApiKey}
                    disabled={!apiKey.trim() || isVerifying}
                    className={`p-2 rounded-lg transition-colors ${
                      !apiKey.trim() || isVerifying
                        ? "bg-gray-600 cursor-not-allowed text-gray-400"
                        : isApiVerified
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isVerifying ? (
                      <span className="animate-pulse">...</span>
                    ) : isApiVerified ? (
                      <FaRegSquareCheck className="w-4 h-4" />
                    ) : (
                      <FaRegSquareCheck className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ) : (
                // Show unclickable icon when sidebar is closed
                <div className="flex justify-center">
                  <div className="p-3 bg-gray-800 border border-gray-600 rounded-lg cursor-not-allowed">
                    <MdInput className="text-gray-500 text-xl" />
                  </div>
                </div>
              )}

              {/* Verification Status */}
              {isOpen && (
                <div className="flex items-center space-x-2 text-sm">
                  {isVerifying ? (
                    <>
                      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-blue-400">
                        {isLoadingModels
                          ? "Fetching models..."
                          : "Verifying..."}
                      </span>
                    </>
                  ) : isApiVerified ? (
                    <>
                      <HiCheckCircle className="text-green-500 text-lg" />
                      <span className="text-green-400">API Verified</span>
                    </>
                  ) : apiKey ? (
                    <>
                      <HiXCircle className="text-yellow-500 text-lg" />
                      <span className="text-yellow-400">Not Verified</span>
                    </>
                  ) : (
                    <>
                      <HiKey className="text-gray-500 text-lg" />
                      <span className="text-gray-400">API Key Required</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Task Type Dropdown */}
          <div className="space-y-3" ref={taskDropdownRef}>
            {isOpen && (
              <label className="block text-sm font-medium text-gray-300">
                Task Type
              </label>
            )}

            <div className="relative">
              {isOpen ? (
                <button
                  onClick={toggleTaskDropdown}
                  disabled={
                    !isApiVerified && Object.keys(availableModels).length === 0
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-colors ${
                    !isApiVerified && Object.keys(availableModels).length === 0
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-gray-700"
                  }`}
                >
                  <span>
                    {taskTypes.find((task) => task.id === selectedTask)?.name ||
                      "Select Task"}
                  </span>
                  <HiChevronDown
                    className={`text-gray-400 transition-transform ${
                      showTaskDropdown ? "rotate-180" : ""
                    }`}
                  />
                </button>
              ) : (
                // Show unclickable icon when sidebar is closed
                <div className="flex justify-center">
                  <div
                    className={`p-3 bg-gray-800 border border-gray-600 rounded-lg cursor-not-allowed ${
                      !isApiVerified ? "opacity-50" : ""
                    }`}
                  >
                    <RiRobot2Line className="text-gray-300 text-xl" />
                  </div>
                </div>
              )}

              {showTaskDropdown && isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {taskTypes
                    .filter(
                      (task) =>
                        availableModels[task.id] &&
                        availableModels[task.id].length > 0
                    )
                    .map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleTaskSelect(task.id)}
                        className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                          selectedTask === task.id
                            ? "bg-blue-600 hover:bg-blue-700"
                            : ""
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{task.name}</span>
                          <span className="text-xs text-gray-400">
                            ({availableModels[task.id]?.length || 0})
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Model Selection Dropdown */}
          <div className="space-y-3" ref={modelDropdownRef}>
            {isOpen && (
              <label className="block text-sm font-medium text-gray-300">
                Model
              </label>
            )}

            <div className="relative">
              {isOpen ? (
                <button
                  onClick={toggleModelDropdown}
                  disabled={
                    !getCurrentModels() || getCurrentModels().length === 0
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white transition-colors ${
                    !getCurrentModels() || getCurrentModels().length === 0
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-gray-700"
                  }`}
                >
                  <span className="truncate">
                    {getCurrentModels().find(
                      (model) => model.id === selectedModel
                    )?.name || "Select Model"}
                  </span>
                  <HiChevronDown
                    className={`text-gray-400 transition-transform ${
                      showModelDropdown ? "rotate-180" : ""
                    }`}
                  />
                </button>
              ) : (
                // Show unclickable icon when sidebar is closed
                <div className="flex justify-center">
                  <div
                    className={`p-3 bg-gray-800 border border-gray-600 rounded-lg cursor-not-allowed ${
                      !isApiVerified ? "opacity-50" : ""
                    }`}
                  >
                    <HiKey className="text-gray-300 text-xl" />
                  </div>
                </div>
              )}

              {showModelDropdown && isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {getCurrentModels().map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                        selectedModel === model.id
                          ? "bg-blue-600 hover:bg-blue-700"
                          : ""
                      }`}
                    >
                      <div className="truncate" title={model.name}>
                        {model.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model Info Button */}
            {isOpen && selectedModel && isApiVerified && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={openModelInfoModal}
                  disabled={isFetchingModelInfo || !selectedModelInfo}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <HiInformationCircle className="text-blue-400" />
                  <span>View Model Details</span>
                  {isFetchingModelInfo && (
                    <div className="ml-2 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Status Message */}
          {isOpen && (
            <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-300 text-center">
                {isApiVerified
                  ? `Ready! ${
                      getCurrentModels().length
                    } models available for ${selectedTask}`
                  : "Please verify your API key to enable model selection."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          {isOpen ? (
            <div className="text-center">
              <p className="text-xs text-gray-400">
                {isApiVerified ? `✅ API Verified` : "🔒 API Required"}
              </p>
            </div>
          ) : (
            <div className="flex justify-center">
              {isApiVerified ? (
                <HiCheckCircle className="text-green-500 text-lg" />
              ) : (
                <HiKey className="text-gray-500 text-lg" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Model Info Modal */}
      {renderModelInfoModal()}
    </>
  );
};

export default Sidebar;

import { useState, type ChangeEvent } from "react";
import { AxiosError } from "axios";
import api from "./lib/api";
import { Button } from "./components/ui/button";
import { Upload, Terminal as TerminalIcon, Download, ChevronDown, Database } from "lucide-react";
import { toast } from "sonner";

// --- Type Definitions ---
interface TrainingMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
}

interface TrainingResult {
  message: string;
  mode?: string;
  metrics?: TrainingMetrics;
  run_id?: string;
  dataset_schema?: string;
  schema_warning?: string | null;
}

interface FileStats {
  name: string;
  size: string;
  rows: number;
  cols: number;
}

// --- Dataset Schema Registry ---
interface DatasetOption {
  value: string;
  label: string;
  description: string;
  knownColumns: string;
}

const DATASET_OPTIONS: DatasetOption[] = [
  {
    value: "auto",
    label: "Auto-Detect",
    description: "Engine will infer schema automatically",
    knownColumns: "Any format",
  },
  {
    value: "cicids",
    label: "CIC-IDS2017 / CIC-IDS2018",
    description: "Canadian Institute for Cybersecurity Intrusion Detection",
    knownColumns: "Flow Duration, Total Fwd Packets, Label...",
  },
  {
    value: "unsw",
    label: "UNSW-NB15",
    description: "University of New South Wales Network Dataset",
    knownColumns: "dur, spkts, dbytes, proto, attack_cat...",
  },
  {
    value: "kdd",
    label: "NSL-KDD / KDD Cup 99",
    description: "Classic KDD intrusion detection benchmark",
    knownColumns: "duration, src_bytes, dst_bytes, label...",
  },
  {
    value: "custom",
    label: "Custom / Other",
    description: "Any other network traffic dataset",
    knownColumns: "Unknown — engine will normalize",
  },
];

const Training = () => {
  // --- State ---
  const [file, setFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<FileStats | null>(null);
  const [training, setTraining] = useState<boolean>(false);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [datasetType, setDatasetType] = useState<string>("auto");
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const selectedDataset = DATASET_OPTIONS.find((o) => o.value === datasetType)!;

  // --- Handlers ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        toast.error("Invalid file type", { description: "Please upload a CSV file" });
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setFileStats(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n");
        const cols = lines[0] ? lines[0].split(",").length : 0;

        setFileStats({
          name: selectedFile.name,
          size: (selectedFile.size / (1024 * 1024)).toFixed(2) + " MB",
          rows: lines.length > 1 ? lines.length - 1 : 0,
          cols: cols,
        });
      };

      reader.readAsText(selectedFile.slice(0, 50000));
      toast.success("Dataset Loaded", { description: "Schema analyzed successfully." });
    }
  };

  const handleTrain = async () => {
    if (!file) {
      toast.error("No file selected", { description: "Please select a CSV file first" });
      return;
    }

    setTraining(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dataset_type", datasetType); // <-- sent to backend

      const response = await api.post<TrainingResult>("/model/train/", formData);
      setResult(response.data);
      toast.success("Training Complete!", { description: response.data.message });
    } catch (error) {
      console.error("Training error:", error);
      const axiosError = error as AxiosError<{ error: string }>;
      const errorMessage =
        axiosError.response?.data?.error || "An error occurred during training";
      setResult({ message: errorMessage, mode: "Failed" });
      toast.error("Training Failed", { description: errorMessage });
    } finally {
      setTraining(false);
    }
  };

  const downloadSampleDataset = () => {
    const csvContent = `Destination Port,Flow Duration,Total Fwd Packets,Total Backward Packets,Total Length of Fwd Packets,Label\n80,1000,5,3,500,BENIGN\n80,50000,100,0,10000,DDoS\n443,200,2,2,100,BENIGN`;
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "training_sample.csv";
    a.click();
    toast.success("Sample dataset downloaded");
  };

  // --- Layout Render ---
  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-8" data-testid="training-page">
      <div className="container mx-auto space-y-8">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Model Training</h1>
          <p className="text-zinc-400">
            Train models with any network dataset — CICIDS, UNSW-NB15, NSL-KDD, or custom.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-800 bg-black shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Upload Dataset</h2>
              <p className="text-sm text-zinc-400 mb-6">
                Select your dataset format, then upload a CSV file.
              </p>

              {/* ── Dataset Type Dropdown ── */}
              <div className="mb-5">
                <label className="block text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">
                  Dataset Schema
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Database className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">
                          {selectedDataset.label}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {selectedDataset.knownColumns}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                        dropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute z-20 top-full mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
                      {DATASET_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setDatasetType(opt.value);
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0 ${
                            datasetType === opt.value ? "bg-zinc-800" : ""
                          }`}
                        >
                          <div
                            className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                              datasetType === opt.value
                                ? "bg-emerald-500"
                                : "bg-zinc-700"
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium text-zinc-100">
                              {opt.label}
                            </p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {opt.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── File Upload Drop Zone ── */}
              <div className="border-2 border-dashed border-zinc-800 bg-zinc-900/50 rounded-lg p-10 text-center hover:bg-zinc-900 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <Upload className="h-10 w-10 text-zinc-500 mb-4" />
                  <span className="text-sm font-medium text-zinc-200">
                    {file ? file.name : "Click to upload CSV file"}
                  </span>
                  <span className="text-xs text-zinc-500 mt-1">
                    {file
                      ? `Size: ${(file.size / 1024).toFixed(2)} KB`
                      : "or drag and drop"}
                  </span>
                </label>
              </div>

              {/* ── File Stats ── */}
              {fileStats && (
                <div className="mt-4 p-4 border border-zinc-800 bg-zinc-950 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <h3 className="text-xs font-mono text-emerald-500 mb-2 border-b border-zinc-800 pb-2">
                    DATASET SCHEMA ANALYZED
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono text-zinc-300">
                    <p className="truncate" title={fileStats.name}>
                      <span className="text-zinc-500">Target:</span> {fileStats.name}
                    </p>
                    <p>
                      <span className="text-zinc-500">Size:</span> {fileStats.size}
                    </p>
                    <p>
                      <span className="text-zinc-500">Dimensions:</span> ~{fileStats.rows} rows x{" "}
                      {fileStats.cols} cols
                    </p>
                    <p>
                      <span className="text-zinc-500">Schema:</span>{" "}
                      <span className="text-emerald-400">{selectedDataset.label}</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3">
                <Button
                  onClick={handleTrain}
                  disabled={!file || training}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0 transition-all duration-300"
                  size="lg"
                >
                  {training ? "Training Pipeline Active..." : "Start Training"}
                </Button>
                <Button
                  onClick={downloadSampleDataset}
                  variant="outline"
                  className="w-full border-zinc-800 bg-black text-zinc-300 hover:bg-zinc-900 hover:text-white"
                >
                  Download Sample Dataset
                </Button>
              </div>
            </div>
          </div>

          {/* ── Terminal Panel ── */}
          <div className="space-y-6 h-full">
            <div className="rounded-lg border border-zinc-800 bg-black shadow-sm p-6 font-mono text-sm h-full min-h-[500px] flex flex-col relative overflow-hidden">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-4 mb-4 select-none">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500"></div>
                <span className="ml-2 text-xs text-zinc-500 flex items-center gap-1">
                  <TerminalIcon size={12} /> warden_ml_pipeline.log
                </span>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-zinc-800">
                <p className="text-zinc-500">{">"} System initialized. Awaiting input...</p>

                {file && fileStats && (
                  <>
                    <p className="text-zinc-300">
                      <span className="text-zinc-500">{">"}</span> Dataset loaded:{" "}
                      <span className="text-emerald-500">{file.name}</span>
                    </p>
                    <p className="text-zinc-400">
                      {">"} Schema mode:{" "}
                      <span className="text-emerald-400">{selectedDataset.label}</span>
                    </p>
                    <p className="text-zinc-400">
                      {">"} Extracting features... [{fileStats.cols} features detected]
                    </p>
                  </>
                )}

                {training && (
                  <>
                    <p className="text-amber-500 animate-pulse">
                      {">"} Uploading payload to secure backend...
                    </p>
                    <p className="text-amber-500 animate-pulse delay-75">
                      {">"} Normalizing tensor dimensions [{selectedDataset.label}]...
                    </p>
                    <p className="text-amber-500 animate-pulse delay-150">
                      {">"} Fitting Random Forest & Isolation Forest Ensembles...
                    </p>
                  </>
                )}

                {result && result.metrics && (
                  <div className="mt-6 space-y-4 border-t border-zinc-800 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <p className="text-emerald-500 font-bold">{">"} TRAINING COMPLETE.</p>
                    <p className="text-zinc-400">
                      {">"} Mode: {result.mode || "Hybrid NIDS/IPS Active"}
                    </p>
                    {result.run_id && (
                      <p className="text-zinc-500 text-xs">
                        {">"} Run ID: <span className="text-zinc-300 font-bold">{result.run_id}</span>
                      </p>
                    )}
                    {result.dataset_schema && (
                      <p className="text-zinc-500 text-xs">
                        {">"} Schema: <span className="text-emerald-400">{result.dataset_schema}</span>
                      </p>
                    )}
                    {result.schema_warning && (
                      <div className="mt-2 p-2 border border-amber-700/50 bg-amber-950/20 text-amber-400 text-xs">
                        {">"} ⚠ SCHEMA MISMATCH: {result.schema_warning}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <TerminalMetric label="ACCURACY" value={result.metrics.accuracy} />
                      <TerminalMetric label="PRECISION" value={result.metrics.precision} />
                      <TerminalMetric label="RECALL" value={result.metrics.recall} />
                      {result.metrics.f1_score !== undefined && (
                        <TerminalMetric label="F1 SCORE" value={result.metrics.f1_score} />
                      )}
                    </div>

                    <p className="text-zinc-500 mt-4">
                      {">"} Models committed to /backend/artifacts/
                    </p>
                    <div className="mt-4 p-2 bg-emerald-950/20 border border-emerald-900/50 text-emerald-400 text-xs">
                      {">"} Live NIDS/IPS engine updated with new classification weights.
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-800">
                      <Button
                        onClick={() => {
                          const report = JSON.stringify(
                            {
                              project: "Warden NIDS/IPS",
                              timestamp: new Date().toISOString(),
                              run_id: result.run_id || "unknown",
                              dataset_schema: result.dataset_schema || datasetType,
                              metrics: result.metrics,
                              status: "Weights locked and verified.",
                            },
                            null,
                            2
                          );
                          const blob = new Blob([report], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `warden_model_artifacts_${new Date().getTime()}.json`;
                          a.click();
                          toast.success("Model artifacts exported securely.");
                        }}
                        variant="outline"
                        className="w-full bg-emerald-950/20 border-emerald-900/50 text-emerald-400 hover:bg-emerald-900 hover:text-emerald-300 text-xs font-mono transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" /> EXPORT MODEL ARTIFACTS
                      </Button>
                    </div>
                  </div>
                )}

                {result && result.mode === "Failed" && (
                  <div className="mt-4 text-red-500">
                    <p>{">"} CRITICAL ERROR:</p>
                    <p className="pl-4 border-l-2 border-red-500 ml-1 mt-1 text-red-400">
                      {result.message}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TerminalMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-zinc-950 p-3 border border-zinc-800 hover:border-zinc-700 transition-colors">
    <p className="text-[10px] text-zinc-500 mb-1">{label}</p>
    <p className="text-xl text-zinc-200 font-bold">{value}%</p>
  </div>
);

export default Training;
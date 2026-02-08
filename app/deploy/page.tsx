"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { compile, type ABIEntry } from "@/lib/compiler";
import { JsonRpcProvider, Wallet, ContractFactory, Contract, formatEther, parseEther } from "ethers";

// ── Chain Presets ────────────────────────────────────────

const CHAINS = [
  { name: "LUXBIN Chain", rpc: "http://127.0.0.1:9944", chainId: 4242, symbol: "LUX" },
  { name: "LUXBIN Testnet", rpc: "http://127.0.0.1:9944", chainId: 4242, symbol: "tLUX" },
  { name: "Ethereum Mainnet", rpc: "https://cloudflare-eth.com", chainId: 1, symbol: "ETH" },
  { name: "Sepolia Testnet", rpc: "https://ethereum-sepolia-rpc.publicnode.com", chainId: 11155111, symbol: "SepoliaETH" },
  { name: "Base", rpc: "https://mainnet.base.org", chainId: 8453, symbol: "ETH" },
  { name: "Base Sepolia", rpc: "https://sepolia.base.org", chainId: 84532, symbol: "ETH" },
  { name: "Custom RPC", rpc: "", chainId: 0, symbol: "ETH" },
];

// ── Example Programs ─────────────────────────────────────

const EXAMPLES = [
  {
    name: "Counter",
    code: `# Simple Counter Contract
let count = 0

func increment()
    count = count + 1
end

func decrement()
    if count > 0 then
        count = count - 1
    end
end

func getCount(): photon_int
    return count
end`,
  },
  {
    name: "Token Vault",
    code: `# Token Vault - Deposit & Withdraw
let totalDeposits = 0

func deposit(amount: photon_int)
    if amount > 0 then
        totalDeposits = totalDeposits + amount
    end
end

func withdraw(amount: photon_int): photon_int
    if amount > totalDeposits then
        return 0
    end
    totalDeposits = totalDeposits - amount
    return amount
end

func getBalance(): photon_int
    return totalDeposits
end`,
  },
  {
    name: "Voting",
    code: `# On-Chain Voting
let votesFor = 0
let votesAgainst = 0
let votingOpen = true

func voteYes()
    if votingOpen then
        votesFor = votesFor + 1
    end
end

func voteNo()
    if votingOpen then
        votesAgainst = votesAgainst + 1
    end
end

func closeVoting(): photon_bool
    votingOpen = false
    return votesFor > votesAgainst
end

func getTotalVotes(): photon_int
    return votesFor + votesAgainst
end`,
  },
];

// ── Types ────────────────────────────────────────────────

type Tab = "write" | "compile" | "deploy" | "interact";

interface DeployedContract {
  address: string;
  abi: ABIEntry[];
  name: string;
  chainName: string;
}

interface CallResult {
  funcName: string;
  result: string;
  error: string | null;
  timestamp: number;
}

// ── Component ────────────────────────────────────────────

export default function DeployPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("write");

  // Write tab
  const [source, setSource] = useState(EXAMPLES[0].code);
  const [contractName, setContractName] = useState("LuxbinContract");

  // Compile tab
  const [solidity, setSolidity] = useState("");
  const [abi, setAbi] = useState<ABIEntry[]>([]);
  const [bytecode, setBytecode] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [solcStatus, setSolcStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // Deploy tab
  const [selectedChain, setSelectedChain] = useState(0);
  const [customRpc, setCustomRpc] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployLog, setDeployLog] = useState<string[]>([]);
  const [deployedContract, setDeployedContract] = useState<DeployedContract | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);

  // Interact tab
  const [funcInputs, setFuncInputs] = useState<Record<string, Record<string, string>>>({});
  const [callResults, setCallResults] = useState<CallResult[]>([]);
  const [calling, setCalling] = useState<string | null>(null);

  // Refs
  const solcWorkerRef = useRef<Worker | null>(null);

  // ── Compile LUXBIN → Solidity + ABI ────────────────────

  const handleCompileLuxbin = useCallback(() => {
    const result = compile(source, contractName);
    if (result.success) {
      setSolidity(result.solidity);
      setAbi(result.abi);
      setWarnings(result.warnings);
      setCompileError(null);
      setBytecode("");
      setActiveTab("compile");
    } else {
      setSolidity("");
      setAbi([]);
      setCompileError(result.error);
      setActiveTab("compile");
    }
  }, [source, contractName]);

  // ── Compile Solidity → Bytecode (via Web Worker + solc CDN) ──

  const handleCompileBytecode = useCallback(() => {
    if (!solidity) return;
    setCompiling(true);
    setSolcStatus("loading");

    const workerCode = `
      self.onmessage = async function(e) {
        try {
          self.postMessage({ type: 'status', message: 'Loading Solidity compiler from CDN...' });

          // Load solc from CDN
          importScripts('https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js');

          self.postMessage({ type: 'status', message: 'Compiler loaded. Compiling...' });

          var input = JSON.stringify({
            language: 'Solidity',
            sources: {
              'Contract.sol': { content: e.data.source }
            },
            settings: {
              optimizer: { enabled: true, runs: 200 },
              outputSelection: {
                '*': { '*': ['abi', 'evm.bytecode.object'] }
              }
            }
          });

          var compile = Module.cwrap('solidity_compile', 'string', ['string', 'number', 'number']);
          var output = JSON.parse(compile(input, 0, 0));

          self.postMessage({ type: 'result', output: output });
        } catch (err) {
          self.postMessage({ type: 'error', message: err.message || 'Compilation failed' });
        }
      };
    `;

    try {
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));
      solcWorkerRef.current = worker;

      worker.onmessage = (e) => {
        if (e.data.type === "status") {
          setSolcStatus("loading");
        } else if (e.data.type === "result") {
          const output = e.data.output;
          if (output.errors?.some((err: { severity: string }) => err.severity === "error")) {
            const errs = output.errors
              .filter((err: { severity: string }) => err.severity === "error")
              .map((err: { formattedMessage: string }) => err.formattedMessage)
              .join("\n");
            setCompileError("Solidity compilation errors:\n" + errs);
            setSolcStatus("error");
          } else {
            // Extract bytecode from first contract
            const contracts = output.contracts?.["Contract.sol"];
            if (contracts) {
              const contractKey = Object.keys(contracts)[0];
              if (contractKey) {
                const bc = contracts[contractKey].evm?.bytecode?.object;
                if (bc) {
                  setBytecode("0x" + bc);
                  setSolcStatus("ready");
                  setCompileError(null);
                }
              }
            }
          }
          setCompiling(false);
          worker.terminate();
        } else if (e.data.type === "error") {
          setCompileError("Solc worker error: " + e.data.message);
          setSolcStatus("error");
          setCompiling(false);
          worker.terminate();
        }
      };

      worker.onerror = () => {
        setCompileError("Failed to load Solidity compiler. You can paste bytecode manually.");
        setSolcStatus("error");
        setCompiling(false);
        worker.terminate();
      };

      worker.postMessage({ source: solidity });
    } catch {
      setCompileError("Web Worker creation failed. Try pasting bytecode manually.");
      setSolcStatus("error");
      setCompiling(false);
    }
  }, [solidity]);

  // ── Check Wallet Balance ───────────────────────────────

  const checkBalance = useCallback(async () => {
    if (!privateKey) return;
    const chain = CHAINS[selectedChain];
    const rpc = chain.rpc || customRpc;
    if (!rpc) return;

    try {
      const provider = new JsonRpcProvider(rpc);
      const wallet = new Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      setWalletBalance(formatEther(balance));
    } catch {
      setWalletBalance(null);
    }
  }, [privateKey, selectedChain, customRpc]);

  // ── Deploy Contract ────────────────────────────────────

  const handleDeploy = useCallback(async () => {
    if (!bytecode || !abi.length || !privateKey) return;

    const chain = CHAINS[selectedChain];
    const rpc = chain.rpc || customRpc;
    if (!rpc) {
      setDeployLog(["Error: No RPC URL configured"]);
      return;
    }

    setDeploying(true);
    setDeployLog([]);
    const log = (msg: string) => setDeployLog((prev) => [...prev, msg]);

    try {
      log(`Connecting to ${chain.name} (${rpc})...`);
      const provider = new JsonRpcProvider(rpc);

      log("Setting up wallet...");
      const wallet = new Wallet(privateKey, provider);
      log(`Deployer: ${wallet.address}`);

      const balance = await provider.getBalance(wallet.address);
      log(`Balance: ${formatEther(balance)} ${chain.symbol}`);

      if (balance === BigInt(0)) {
        log("ERROR: Wallet has no funds for gas");
        setDeploying(false);
        return;
      }

      log("Creating contract factory...");
      const factory = new ContractFactory(abi, bytecode, wallet);

      log("Deploying contract...");
      const contract = await factory.deploy();
      log(`Transaction sent: ${contract.deploymentTransaction()?.hash}`);

      log("Waiting for confirmation...");
      await contract.waitForDeployment();
      const address = await contract.getAddress();

      log(`Contract deployed at: ${address}`);
      log("Deployment successful!");

      setDeployedContract({
        address,
        abi,
        name: contractName,
        chainName: chain.name,
      });
      setActiveTab("interact");
    } catch (e: unknown) {
      log(`ERROR: ${e instanceof Error ? e.message : "Deployment failed"}`);
    } finally {
      setDeploying(false);
    }
  }, [bytecode, abi, privateKey, selectedChain, customRpc, contractName]);

  // ── Interact With Contract ─────────────────────────────

  const handleCall = useCallback(
    async (func: ABIEntry) => {
      if (!deployedContract || !privateKey || !func.name) return;

      const chain = CHAINS[selectedChain];
      const rpc = chain.rpc || customRpc;
      setCalling(func.name);

      try {
        const provider = new JsonRpcProvider(rpc);
        const wallet = new Wallet(privateKey, provider);
        const contract = new Contract(deployedContract.address, deployedContract.abi, wallet);

        // Get input values
        const inputs = funcInputs[func.name] || {};
        const args = (func.inputs || []).map((input) => {
          const val = inputs[input.name] || "0";
          if (input.type === "int256" || input.type === "uint256") {
            return BigInt(val);
          }
          if (input.type === "bool") return val === "true";
          return val;
        });

        let result: string;
        if (func.stateMutability === "view" || func.stateMutability === "pure") {
          const res = await contract[func.name](...args);
          result = String(res);
        } else {
          const tx = await contract[func.name](...args);
          const receipt = await tx.wait();
          result = `TX: ${receipt.hash} (gas used: ${receipt.gasUsed.toString()})`;
        }

        setCallResults((prev) => [
          { funcName: func.name!, result, error: null, timestamp: Date.now() },
          ...prev,
        ]);
      } catch (e: unknown) {
        setCallResults((prev) => [
          {
            funcName: func.name!,
            result: "",
            error: e instanceof Error ? e.message : "Call failed",
            timestamp: Date.now(),
          },
          ...prev,
        ]);
      } finally {
        setCalling(null);
      }
    },
    [deployedContract, privateKey, selectedChain, customRpc, funcInputs]
  );

  // ── UI ─────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; badge?: string }[] = [
    { key: "write", label: "Write" },
    { key: "compile", label: "Compile", badge: solidity ? "1" : undefined },
    { key: "deploy", label: "Deploy", badge: bytecode ? "1" : undefined },
    {
      key: "interact",
      label: "Interact",
      badge: deployedContract ? "1" : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Nav */}
      <nav className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-2 rounded bg-gradient-to-r from-violet-500 via-cyan-500 to-red-500" />
            <span className="text-white font-semibold text-lg">LUXBIN</span>
            <span className="bg-violet-500/20 text-violet-300 text-xs px-2 py-0.5 rounded-full font-medium">
              Deploy IDE
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition">
              Compiler
            </Link>
            <Link href="/subdomains" className="text-sm text-gray-400 hover:text-white transition">
              Subdomains
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                activeTab === tab.key
                  ? "bg-violet-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="w-2 h-2 bg-green-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── WRITE TAB ──────────────────────────────────── */}
        {activeTab === "write" && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Contract:</label>
                <input
                  type="text"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-44 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <button
                onClick={handleCompileLuxbin}
                className="bg-gradient-to-r from-violet-600 to-cyan-600 text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Compile &amp; Continue
              </button>
              <div className="flex gap-1 ml-auto">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.name}
                    onClick={() => setSource(ex.code)}
                    className="px-2 py-1 text-xs rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-violet-500/30 transition"
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              className="w-full h-[600px] bg-slate-900/80 border border-white/10 rounded-xl p-4 text-sm text-green-300 font-mono resize-none focus:outline-none focus:border-violet-500/50 leading-relaxed"
              placeholder="Write LUXBIN code here..."
            />
          </div>
        )}

        {/* ── COMPILE TAB ────────────────────────────────── */}
        {activeTab === "compile" && (
          <div>
            {compileError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <pre className="text-red-400 text-sm font-mono whitespace-pre-wrap">{compileError}</pre>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4">
                <h3 className="text-yellow-400 text-xs font-semibold mb-1">Warnings ({warnings.length})</h3>
                {warnings.map((w, i) => (
                  <p key={i} className="text-yellow-300/70 text-xs font-mono">&#9888; {w}</p>
                ))}
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Solidity Output */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-medium text-cyan-400">Solidity Output</h2>
                  {solidity && (
                    <button
                      onClick={handleCompileBytecode}
                      disabled={compiling}
                      className="bg-violet-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                    >
                      {compiling ? "Compiling..." : "Compile Bytecode"}
                    </button>
                  )}
                </div>
                <pre className="h-[500px] bg-slate-900/80 border border-white/10 rounded-xl p-4 text-sm text-cyan-200 font-mono whitespace-pre overflow-auto">
                  {solidity || "Compile LUXBIN code first..."}
                </pre>
              </div>

              {/* ABI + Bytecode */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-medium text-violet-400 mb-2">
                    ABI ({abi.length} entries)
                  </h2>
                  <pre className="h-[220px] bg-slate-900/80 border border-white/10 rounded-xl p-4 text-xs text-gray-300 font-mono whitespace-pre overflow-auto">
                    {abi.length > 0 ? JSON.stringify(abi, null, 2) : "No ABI generated yet..."}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-medium text-emerald-400">
                      Bytecode {bytecode ? `(${(bytecode.length / 2).toLocaleString()} bytes)` : ""}
                    </h2>
                    {solcStatus === "loading" && (
                      <span className="text-xs text-yellow-400 animate-pulse">Loading solc...</span>
                    )}
                    {solcStatus === "ready" && (
                      <span className="text-xs text-green-400">Ready to deploy</span>
                    )}
                  </div>
                  <textarea
                    value={bytecode}
                    onChange={(e) => setBytecode(e.target.value)}
                    placeholder={
                      solcStatus === "error"
                        ? 'Click "Compile Bytecode" or paste bytecode from Remix here (0x...)...'
                        : 'Click "Compile Bytecode" above, or paste from Remix...'
                    }
                    className="h-[220px] w-full bg-slate-900/80 border border-white/10 rounded-xl p-4 text-xs text-emerald-300 font-mono resize-none overflow-auto focus:outline-none focus:border-violet-500/50"
                  />
                </div>

                {bytecode && abi.length > 0 && (
                  <button
                    onClick={() => setActiveTab("deploy")}
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition"
                  >
                    Continue to Deploy &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── DEPLOY TAB ─────────────────────────────────── */}
        {activeTab === "deploy" && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Config */}
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h2 className="text-white font-semibold mb-4">Chain Configuration</h2>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Network</label>
                    <select
                      value={selectedChain}
                      onChange={(e) => setSelectedChain(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    >
                      {CHAINS.map((chain, i) => (
                        <option key={i} value={i}>
                          {chain.name} {chain.chainId ? `(${chain.chainId})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {CHAINS[selectedChain].name === "Custom RPC" && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">RPC URL</label>
                      <input
                        type="text"
                        value={customRpc}
                        onChange={(e) => setCustomRpc(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Deployer Private Key</label>
                    <input
                      type="password"
                      value={privateKey}
                      onChange={(e) => {
                        setPrivateKey(e.target.value);
                        setWalletBalance(null);
                      }}
                      placeholder="0x..."
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500/50"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-600">Never shared. Processed client-side only.</p>
                      {privateKey && (
                        <button onClick={checkBalance} className="text-xs text-violet-400 hover:text-violet-300">
                          Check balance
                        </button>
                      )}
                    </div>
                    {walletBalance !== null && (
                      <p className="text-xs text-green-400 mt-1">
                        Balance: {walletBalance} {CHAINS[selectedChain].symbol}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleDeploy}
                  disabled={!bytecode || !abi.length || !privateKey || deploying}
                  className="w-full mt-4 bg-gradient-to-r from-violet-600 to-emerald-600 text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deploying ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Deploying...
                    </>
                  ) : (
                    <>Deploy to {CHAINS[selectedChain].name}</>
                  )}
                </button>

                {!bytecode && (
                  <p className="text-xs text-yellow-400/60 text-center mt-2">
                    Compile bytecode first in the Compile tab
                  </p>
                )}
              </div>

              {/* Deploy Status Summary */}
              {deployedContract && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <h3 className="text-green-400 font-semibold text-sm mb-2">Deployed Successfully</h3>
                  <div className="space-y-1 text-xs">
                    <p className="text-gray-300">
                      <span className="text-gray-500">Contract:</span>{" "}
                      <span className="text-white font-mono">{deployedContract.name}</span>
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Address:</span>{" "}
                      <span className="text-cyan-400 font-mono break-all">{deployedContract.address}</span>
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Chain:</span> {deployedContract.chainName}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("interact")}
                    className="mt-3 w-full bg-green-600/30 text-green-300 py-1.5 rounded-lg text-xs font-medium hover:bg-green-600/40 transition"
                  >
                    Interact with Contract &rarr;
                  </button>
                </div>
              )}
            </div>

            {/* Deploy Log */}
            <div>
              <h2 className="text-sm font-medium text-gray-400 mb-2">Deployment Log</h2>
              <div className="h-[450px] bg-slate-900/80 border border-white/10 rounded-xl p-4 overflow-auto">
                {deployLog.length === 0 ? (
                  <p className="text-gray-600 text-sm italic">Configure and deploy to see output...</p>
                ) : (
                  <div className="space-y-1">
                    {deployLog.map((msg, i) => (
                      <p
                        key={i}
                        className={`text-xs font-mono ${
                          msg.startsWith("ERROR") ? "text-red-400" : msg.includes("successful") ? "text-green-400" : "text-gray-300"
                        }`}
                      >
                        <span className="text-gray-600">[{i + 1}]</span> {msg}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── INTERACT TAB ───────────────────────────────── */}
        {activeTab === "interact" && (
          <div>
            {!deployedContract ? (
              <div className="text-center py-20">
                <p className="text-gray-500 mb-4">No contract deployed yet.</p>
                <button
                  onClick={() => setActiveTab("deploy")}
                  className="text-violet-400 hover:text-violet-300 text-sm"
                >
                  Go to Deploy tab
                </button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Contract Functions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-white font-semibold">
                      {deployedContract.name}
                    </h2>
                    <span className="text-xs text-gray-500 font-mono">
                      {deployedContract.address.slice(0, 8)}...{deployedContract.address.slice(-6)}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {deployedContract.abi
                      .filter((f) => f.type === "function")
                      .map((func) => {
                        const isRead = func.stateMutability === "view" || func.stateMutability === "pure";
                        const inputs = funcInputs[func.name!] || {};

                        return (
                          <div
                            key={func.name}
                            className={`border rounded-xl p-4 ${
                              isRead
                                ? "bg-blue-500/5 border-blue-500/20"
                                : "bg-orange-500/5 border-orange-500/20"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${isRead ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"}`}>
                                  {isRead ? "READ" : "WRITE"}
                                </span>
                                <span className="text-white font-medium text-sm font-mono">
                                  {func.name}
                                </span>
                              </div>
                              {func.outputs && func.outputs.length > 0 && (
                                <span className="text-xs text-gray-500">
                                  → {func.outputs.map((o) => o.type).join(", ")}
                                </span>
                              )}
                            </div>

                            {/* Input fields */}
                            {func.inputs && func.inputs.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {func.inputs.map((input) => (
                                  <div key={input.name} className="flex items-center gap-2">
                                    <label className="text-xs text-gray-500 w-20 shrink-0 font-mono">
                                      {input.name || "arg"} <span className="text-gray-700">({input.type})</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={inputs[input.name] || ""}
                                      onChange={(e) =>
                                        setFuncInputs((prev) => ({
                                          ...prev,
                                          [func.name!]: { ...prev[func.name!], [input.name]: e.target.value },
                                        }))
                                      }
                                      placeholder={input.type === "bool" ? "true/false" : "0"}
                                      className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-violet-500/50"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            <button
                              onClick={() => handleCall(func)}
                              disabled={calling === func.name}
                              className={`w-full py-1.5 rounded-lg text-xs font-medium transition ${
                                isRead
                                  ? "bg-blue-600/30 text-blue-300 hover:bg-blue-600/40"
                                  : "bg-orange-600/30 text-orange-300 hover:bg-orange-600/40"
                              } disabled:opacity-50`}
                            >
                              {calling === func.name ? "Calling..." : isRead ? "Call" : "Transact"}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Call Results */}
                <div>
                  <h2 className="text-sm font-medium text-gray-400 mb-3">Results</h2>
                  <div className="space-y-2">
                    {callResults.length === 0 ? (
                      <p className="text-gray-600 text-sm italic py-8 text-center">
                        Call a function to see results...
                      </p>
                    ) : (
                      callResults.map((r, i) => (
                        <div
                          key={i}
                          className={`border rounded-lg p-3 ${
                            r.error ? "bg-red-500/5 border-red-500/20" : "bg-green-500/5 border-green-500/20"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono text-white">{r.funcName}()</span>
                            <span className="text-xs text-gray-600">
                              {new Date(r.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          {r.error ? (
                            <p className="text-xs text-red-400 font-mono break-all">{r.error}</p>
                          ) : (
                            <p className="text-xs text-green-400 font-mono break-all">{r.result}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 border-t border-white/10 pt-4 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-1.5 rounded bg-gradient-to-r from-violet-500 via-cyan-500 to-red-500" />
              <span className="text-gray-500 text-sm">LUXBIN Deploy IDE v1.0</span>
            </div>
            <p className="text-gray-600 text-xs">
              Write LUXBIN &rarr; Compile to Solidity &rarr; Deploy to any EVM chain
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

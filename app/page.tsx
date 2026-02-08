"use client";

import { useState, useCallback } from "react";
import { compile } from "@/lib/compiler";

// ── Example Programs ─────────────────────────────────────

const EXAMPLES: { name: string; code: string }[] = [
  {
    name: "Counter Contract",
    code: `# LUXBIN Counter Contract
# A simple on-chain counter

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
end

func reset()
    count = 0
end`,
  },
  {
    name: "Token Vault",
    code: `# LUXBIN Token Vault
# Simple deposit/withdraw tracker

let totalDeposits = 0
let owner = 0

func deposit(amount: photon_int)
    if amount > 0 then
        totalDeposits = totalDeposits + amount
        photon_print("Deposit successful")
    end
end

func withdraw(amount: photon_int): photon_int
    if amount > totalDeposits then
        photon_print("Insufficient balance")
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
    name: "Voting System",
    code: `# LUXBIN Voting System
# On-chain proposal voting

let proposalCount = 0
let votesFor = 0
let votesAgainst = 0
let votingOpen = true

func createProposal()
    proposalCount = proposalCount + 1
    votesFor = 0
    votesAgainst = 0
    votingOpen = true
end

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
  {
    name: "Math Functions",
    code: `# LUXBIN Math Demo
# Demonstrates math operations on EVM

func factorial(n: photon_int): photon_int
    if n <= 1 then
        return 1
    end
    return n * factorial(n - 1)
end

func fibonacci(n: photon_int): photon_int
    if n <= 0 then
        return 0
    end
    if n == 1 then
        return 1
    end
    let a = 0
    let b = 1
    let i = 2
    while i <= n do
        let temp = b
        b = a + b
        a = temp
        i = i + 1
    end
    return b
end

func power(base: photon_int, exp: photon_int): photon_int
    return base ^ exp
end

func isEven(n: photon_int): photon_bool
    return n % 2 == 0
end`,
  },
  {
    name: "Quantum Random (VRF)",
    code: `# LUXBIN Quantum Random Number Generator
# Quantum operations compile to on-chain randomness (VRF)

func quantumRandom(): photon_int
    let q = superpose(0)
    let result = measure(q)
    return result
end

func randomInRange(low: photon_int, high: photon_int): photon_int
    let range = high - low + 1
    let r = quantumRandom() % range
    return low + r
end

func coinFlip(): photon_bool
    let q = superpose(0)
    let result = measure(q)
    return result == 1
end`,
  },
];

// ── Main Page Component ──────────────────────────────────

export default function CompilerPage() {
  const [source, setSource] = useState(EXAMPLES[0].code);
  const [contractName, setContractName] = useState("LuxbinContract");
  const [output, setOutput] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCompile = useCallback(() => {
    const result = compile(source, contractName);
    if (result.success) {
      setOutput(result.solidity);
      setWarnings(result.warnings);
      setError(null);
    } else {
      setOutput("");
      setWarnings([]);
      setError(result.error);
    }
  }, [source, contractName]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleLoadExample = useCallback((code: string) => {
    setSource(code);
    setOutput("");
    setWarnings([]);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Nav */}
      <nav className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-2 rounded bg-gradient-to-r from-violet-500 via-cyan-500 to-red-500" />
            <span className="text-white font-semibold text-lg">LUXBIN</span>
            <span className="text-violet-400 text-sm font-medium hidden sm:inline">EVM Compiler</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/subdomains"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Subdomains
            </a>
            <a
              href="https://drainer-defense-web.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Drainer Defense
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            LUXBIN{" "}
            <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              to EVM
            </span>{" "}
            Compiler
          </h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Write smart contracts in LUXBIN Light Language and compile them to Solidity for the Ethereum Virtual Machine.
            The world&apos;s first photonic programming language for blockchain.
          </p>
        </div>

        {/* Examples Bar */}
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.name}
              onClick={() => handleLoadExample(ex.code)}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-violet-500/20 hover:border-violet-500/30 hover:text-white transition"
            >
              {ex.name}
            </button>
          ))}
        </div>

        {/* Contract Name + Compile */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Contract Name:</label>
            <input
              type="text"
              value={contractName}
              onChange={(e) => setContractName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white w-48 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <button
            onClick={handleCompile}
            className="bg-gradient-to-r from-violet-600 to-cyan-600 text-white px-6 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Compile to Solidity
          </button>
        </div>

        {/* Editor + Output */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* LUXBIN Source */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-violet-400">LUXBIN Source</h2>
              <span className="text-xs text-gray-600">{source.split("\n").length} lines</span>
            </div>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              className="flex-1 min-h-[500px] bg-slate-900/80 border border-white/10 rounded-xl p-4 text-sm text-green-300 font-mono resize-none focus:outline-none focus:border-violet-500/50 leading-relaxed"
              placeholder="Write LUXBIN code here..."
            />
          </div>

          {/* Solidity Output */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-cyan-400">Solidity Output</h2>
              {output && (
                <button
                  onClick={handleCopy}
                  className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="flex-1 min-h-[500px] bg-slate-900/80 border border-white/10 rounded-xl p-4 overflow-auto">
              {error ? (
                <div className="text-red-400 text-sm font-mono">
                  <div className="text-red-500 font-semibold mb-2">Compilation Error</div>
                  {error}
                </div>
              ) : output ? (
                <pre className="text-sm text-cyan-200 font-mono whitespace-pre leading-relaxed">
                  {output}
                </pre>
              ) : (
                <div className="text-gray-600 text-sm italic">
                  Click &quot;Compile to Solidity&quot; to see the output...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <h3 className="text-yellow-400 text-sm font-semibold mb-2">
              Compiler Warnings ({warnings.length})
            </h3>
            <ul className="space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-yellow-300/80 text-xs font-mono flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">&#9888;</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Language Reference */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-violet-400 font-semibold mb-3">LUXBIN Types</h3>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">photon_int</span>
                <span className="text-cyan-400">int256</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">photon_string</span>
                <span className="text-cyan-400">string</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">photon_bool</span>
                <span className="text-cyan-400">bool</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">photon_float</span>
                <span className="text-yellow-400">int256 *</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">qubit</span>
                <span className="text-yellow-400">VRF *</span>
              </div>
            </div>
            <p className="text-gray-600 text-xs mt-2">* = approximate mapping</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-violet-400 font-semibold mb-3">LUXBIN Keywords</h3>
            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
              {[
                "let", "const", "func", "return", "if", "then", "else", "end",
                "while", "do", "for", "in", "break", "continue", "and", "or", "not",
                "true", "false", "nil",
              ].map((kw) => (
                <span key={kw} className="bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded">
                  {kw}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-violet-400 font-semibold mb-3">Operator Mapping</h3>
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400">+ - * / %</span>
                <span className="text-cyan-400">+ - * / %</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">^</span>
                <span className="text-cyan-400">** (power)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">and or not</span>
                <span className="text-cyan-400">&amp;&amp; || !</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">== != &lt; &gt;</span>
                <span className="text-cyan-400">== != &lt; &gt;</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">photon_print()</span>
                <span className="text-cyan-400">emit Log()</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">measure(q)</span>
                <span className="text-cyan-400">VRF random</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-white/10 pt-6 pb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-1.5 rounded bg-gradient-to-r from-violet-500 via-cyan-500 to-red-500" />
              <span className="text-gray-500 text-sm">LUXBIN EVM Compiler v1.0</span>
            </div>
            <p className="text-gray-600 text-xs">
              Part of the LUXBIN Quantum Development Suite — luxbin.eth
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

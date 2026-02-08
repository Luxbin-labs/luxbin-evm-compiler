"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { namehash, keccak256, toUtf8Bytes } from "ethers";

// ENS contract addresses (Ethereum mainnet)
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const _ENS_NAME_WRAPPER = "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401";
const _ENS_PUBLIC_RESOLVER = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63";

const LUXBIN_NAMEHASH = namehash("luxbin.eth");

interface SubdomainRequest {
  name: string;
  owner: string;
  status: "pending" | "ready" | "error";
  error?: string;
  txData?: string;
}

export default function SubdomainsPage() {
  const [subdomain, setSubdomain] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [request, setRequest] = useState<SubdomainRequest | null>(null);
  const [showInfo, setShowInfo] = useState(true);

  const validateSubdomain = useCallback((name: string): string | null => {
    if (name.length < 3) return "Name must be at least 3 characters";
    if (name.length > 32) return "Name must be 32 characters or less";
    if (!/^[a-z0-9-]+$/.test(name)) return "Only lowercase letters, numbers, and hyphens allowed";
    if (name.startsWith("-") || name.endsWith("-")) return "Cannot start or end with a hyphen";
    return null;
  }, []);

  const generateRequest = useCallback(() => {
    const validationError = validateSubdomain(subdomain);
    if (validationError) {
      setRequest({ name: subdomain, owner: ownerAddress, status: "error", error: validationError });
      return;
    }

    if (!ownerAddress || !/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
      setRequest({ name: subdomain, owner: ownerAddress, status: "error", error: "Invalid Ethereum address" });
      return;
    }

    // Generate the ENS setSubnodeOwner call data
    // Function: setSubnodeOwner(bytes32 node, bytes32 label, address owner)
    const labelHash = keccak256(toUtf8Bytes(subdomain));
    const fullName = `${subdomain}.luxbin.eth`;
    const fullNamehash = namehash(fullName);

    setRequest({
      name: subdomain,
      owner: ownerAddress,
      status: "ready",
      txData: JSON.stringify(
        {
          contract: ENS_REGISTRY,
          method: "setSubnodeOwner(bytes32,bytes32,address)",
          params: {
            node: LUXBIN_NAMEHASH,
            label: labelHash,
            owner: ownerAddress,
          },
          result: {
            fullName,
            namehash: fullNamehash,
          },
        },
        null,
        2
      ),
    });
  }, [subdomain, ownerAddress, validateSubdomain]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Nav */}
      <nav className="border-b border-white/10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-2 rounded bg-gradient-to-r from-violet-500 via-cyan-500 to-red-500" />
            <span className="text-white font-semibold text-lg">LUXBIN</span>
            <span className="text-violet-400 text-sm font-medium hidden sm:inline">Subdomains</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition">
              Compiler
            </Link>
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

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Get Your{" "}
            <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              .luxbin.eth
            </span>{" "}
            Name
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Claim your identity on the LUXBIN network. ENS subdomains resolve on-chain and work
            everywhere ENS is supported.
          </p>
        </div>

        {/* Info Panel */}
        {showInfo && (
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6 mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-violet-400 font-semibold mb-2">How LUXBIN Subdomains Work</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 mt-0.5">1.</span>
                    <span>
                      <strong className="text-white">Choose your name</strong> — pick a unique name
                      that becomes <code className="text-cyan-400">yourname.luxbin.eth</code>
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 mt-0.5">2.</span>
                    <span>
                      <strong className="text-white">Enter your wallet address</strong> — the
                      Ethereum address that will own the subdomain
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 mt-0.5">3.</span>
                    <span>
                      <strong className="text-white">Request registration</strong> — generates the
                      transaction data for the luxbin.eth owner to execute
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 mt-0.5">4.</span>
                    <span>
                      <strong className="text-white">Resolution</strong> — once registered, your
                      subdomain resolves on-chain via ENS across all compatible dApps
                    </span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-gray-500 hover:text-white transition text-xl leading-none"
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {/* Registration Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Register Subdomain</h2>

          {/* Name Input */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Subdomain Name</label>
            <div className="flex items-center">
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="yourname"
                className="flex-1 bg-slate-900/80 border border-white/10 rounded-l-xl px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-violet-500/50"
              />
              <div className="bg-slate-800 border border-white/10 border-l-0 rounded-r-xl px-4 py-3 text-gray-400 text-lg font-mono">
                .luxbin.eth
              </div>
            </div>
            {subdomain && (
              <p className="text-xs text-gray-500 mt-1">
                Full name: <span className="text-cyan-400 font-mono">{subdomain}.luxbin.eth</span>
              </p>
            )}
          </div>

          {/* Owner Address */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Owner Address</label>
            <input
              type="text"
              value={ownerAddress}
              onChange={(e) => setOwnerAddress(e.target.value)}
              placeholder="0x..."
              className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-violet-500/50"
            />
            <p className="text-xs text-gray-600 mt-1">
              The Ethereum address that will own this subdomain
            </p>
          </div>

          {/* Register Button */}
          <button
            onClick={generateRequest}
            disabled={!subdomain || !ownerAddress}
            className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white py-3 rounded-xl font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Generate Registration Request
          </button>
        </div>

        {/* Result */}
        {request && (
          <div className="mt-6">
            {request.status === "error" ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-400 text-sm">{request.error}</p>
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6">
                <h3 className="text-green-400 font-semibold mb-2">Registration Request Generated</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Subdomain{" "}
                  <code className="text-cyan-400 font-mono">{request.name}.luxbin.eth</code>{" "}
                  is ready to be registered for address{" "}
                  <code className="text-cyan-400 font-mono text-xs">{request.owner}</code>.
                </p>

                <div className="bg-slate-900/80 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">ENS Transaction Data</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(request.txData || "")}
                      className="text-xs text-gray-400 hover:text-white transition"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="text-xs text-cyan-200 font-mono whitespace-pre-wrap overflow-x-auto">
                    {request.txData}
                  </pre>
                </div>

                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                  <p className="text-sm text-gray-300">
                    <strong className="text-violet-400">Next step:</strong> The owner of{" "}
                    <code className="text-cyan-400">luxbin.eth</code> needs to execute this
                    transaction on the ENS Registry contract to register your subdomain.
                    Contact{" "}
                    <code className="text-cyan-400">nichebiche.eth</code> to complete
                    registration.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Use Cases */}
        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          {[
            {
              title: "Wallet Identity",
              desc: "Use yourname.luxbin.eth as your wallet address across all ENS-compatible dApps.",
            },
            {
              title: "Developer Profile",
              desc: "Deploy LUXBIN smart contracts and link them to your .luxbin.eth identity.",
            },
            {
              title: "Community Access",
              desc: "Holding a .luxbin.eth subdomain grants access to the LUXBIN developer community.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white/5 border border-white/10 rounded-xl p-5"
            >
              <h3 className="text-white font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-white/10 pt-6 pb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-1.5 rounded bg-gradient-to-r from-violet-500 via-cyan-500 to-red-500" />
              <span className="text-gray-500 text-sm">LUXBIN Subdomain Registry</span>
            </div>
            <p className="text-gray-600 text-xs">
              Powered by ENS — luxbin.eth
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

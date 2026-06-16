"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Server, 
  Cpu, 
  Terminal, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Plus, 
  ExternalLink 
} from "lucide-react";
import styles from "./page.module.css";

interface Instance {
  instanceId: string;
  instanceType: string;
  state: string;
  publicIp: string | null;
  privateIp: string | null;
  launchTime: string;
  name: string;
  createdByApp: boolean;
  keyName: string;
}

interface LogMessage {
  time: string;
  message: string;
}

const REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia) - us-east-1" },
  { value: "us-east-2", label: "US East (Ohio) - us-east-2" },
  { value: "us-west-1", label: "US West (N. California) - us-west-1" },
  { value: "us-west-2", label: "US West (Oregon) - us-west-2" },
  { value: "eu-west-1", label: "Europe (Ireland) - eu-west-1" },
  { value: "eu-central-1", label: "Europe (Frankfurt) - eu-central-1" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore) - ap-southeast-1" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo) - ap-northeast-1" },
];

const INSTANCE_TYPES = [
  { value: "t2.micro", label: "t2.micro (Free Tier Eligible in older regions)" },
  { value: "t3.micro", label: "t3.micro (Free Tier Eligible in newer regions)" },
];

export default function Home() {
  const [region, setRegion] = useState("us-east-1");
  const [instanceName, setInstanceName] = useState("");
  const [instanceType, setInstanceType] = useState("t2.micro");
  
  const [awsStatus, setAwsStatus] = useState<{ configured: boolean; region: string | null } | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, message }]);
  };

  // Auto scroll console logs
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Check AWS Configuration status
  const checkAwsStatus = async () => {
    try {
      addLog("Checking AWS credentials configure state...");
      const res = await fetch("/api/aws/status");
      const data = await res.json();
      setAwsStatus(data);
      if (data.configured) {
        addLog(`AWS Credentials successfully configured. Default region: ${data.region || "us-east-1"}`);
        if (data.region) {
          setRegion(data.region);
        }
      } else {
        addLog("AWS Credentials not configured. Please add AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY to your environment variables.");
      }
    } catch (err: any) {
      addLog(`Error checking credentials: ${err.message}`);
    }
  };

  // Fetch Instances
  const fetchInstances = async (targetRegion = region) => {
    if (!awsStatus?.configured) return;
    setLoadingInstances(true);
    addLog(`Fetching EC2 instances from region ${targetRegion}...`);
    try {
      const res = await fetch(`/api/aws/instances?region=${targetRegion}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setInstances(data.instances || []);
      addLog(`Successfully loaded ${data.instances?.length || 0} instances from ${targetRegion}.`);
    } catch (err: any) {
      addLog(`Failed to load instances: ${err.message}`);
    } finally {
      setLoadingInstances(false);
    }
  };

  useEffect(() => {
    checkAwsStatus();
  }, []);

  useEffect(() => {
    if (awsStatus?.configured) {
      fetchInstances(region);
    }
  }, [awsStatus, region]);

  // Create Instance Handler
  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingInstance) return;
    
    setCreatingInstance(true);
    const name = instanceName.trim() || `App-EC2-${Date.now().toString().slice(-4)}`;
    addLog(`Initiating provisioning: Launching ${instanceType} in ${region} named "${name}"...`);
    
    try {
      const res = await fetch("/api/aws/instances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instanceName: name,
          instanceType,
          region,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create instance");
      }

      addLog(`Provision success! Launched instance ID: ${data.instanceId}. Initial state: ${data.state}.`);
      setInstanceName("");
      // Refresh instances list
      fetchInstances(region);
    } catch (err: any) {
      addLog(`Provision error: ${err.message}`);
      alert(`Error launching instance: ${err.message}`);
    } finally {
      setCreatingInstance(false);
    }
  };

  // Terminate Instance Handler
  const handleTerminateInstance = async (instanceId: string) => {
    if (!confirm("Are you sure you want to terminate this instance? This cannot be undone.")) {
      return;
    }
    
    setTerminatingId(instanceId);
    addLog(`Initiating termination for instance ${instanceId} in ${region}...`);
    
    try {
      const res = await fetch(`/api/aws/instances/${instanceId}/terminate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ region }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to terminate instance");
      }

      addLog(`Termination instruction sent! State transitioned from ${data.previousState} to ${data.currentState}.`);
      // Refresh instances list
      fetchInstances(region);
    } catch (err: any) {
      addLog(`Termination error: ${err.message}`);
      alert(`Error terminating instance: ${err.message}`);
    } finally {
      setTerminatingId(null);
    }
  };

  // Copy SSH Command Helper
  const copySSHCommand = (ip: string, id: string) => {
    const cmd = `ssh -i your-key.pem ec2-user@${ip}`;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedId(id);
      addLog(`Copied SSH helper command for instance ${id} to clipboard.`);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className={styles.container}>
      {/* Top Navigation / Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1>AWS Compute Creator</h1>
          <p>Provision and manage AWS EC2 Free Tier instances directly on Vercel</p>
        </div>
        
        {awsStatus ? (
          <div className={styles.statusIndicator}>
            <span className={`${styles.statusDot} ${awsStatus.configured ? styles.connected : styles.disconnected}`} />
            <span>
              {awsStatus.configured ? "AWS Configured" : "Credentials Missing"}
            </span>
          </div>
        ) : (
          <div className={styles.statusIndicator}>
            <Loader2 className={styles.statusDot} size={14} style={{ animation: "spin 1s linear infinite" }} />
            <span>Connecting...</span>
          </div>
        )}
      </header>

      {/* Main Grid Section */}
      <main className={styles.dashboardGrid}>
        
        {/* Left Hand: Creation Console */}
        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <Cpu size={18} color="var(--accent-primary)" />
            <h2>Provision Compute</h2>
          </div>
          
          <form onSubmit={handleCreateInstance} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            <div className={styles.formGroup}>
              <label htmlFor="region-select">AWS Target Region</label>
              <select 
                id="region-select"
                className={styles.select}
                value={region} 
                onChange={(e) => setRegion(e.target.value)}
                disabled={creatingInstance || !awsStatus?.configured}
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="instance-type-select">Instance Profile</label>
              <select 
                id="instance-type-select"
                className={styles.select}
                value={instanceType}
                onChange={(e) => setInstanceType(e.target.value)}
                disabled={creatingInstance || !awsStatus?.configured}
              >
                {INSTANCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <span className={styles.helpText}>
                Amazon Linux 2023 AMI is resolved automatically based on your selected region.
              </span>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="instance-name-input">Instance Name Tag</label>
              <input 
                id="instance-name-input"
                type="text" 
                className={styles.input}
                placeholder="e.g. production-api-worker" 
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                disabled={creatingInstance || !awsStatus?.configured}
              />
            </div>

            <button 
              type="submit" 
              className={styles.button}
              disabled={creatingInstance || !awsStatus?.configured}
            >
              {creatingInstance ? (
                <>
                  <Loader2 size={16} style={{ animation: "spin 1.5s linear infinite" }} />
                  Provisioning...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Launch Compute
                </>
              )}
            </button>
          </form>

          {!awsStatus?.configured && awsStatus !== null && (
            <div style={{
              display: "flex", 
              gap: "0.5rem", 
              background: "rgba(244, 63, 94, 0.08)", 
              border: "1px solid rgba(244, 63, 94, 0.2)",
              padding: "0.85rem",
              borderRadius: "8px",
              color: "#fda4af",
              fontSize: "0.8125rem",
              lineHeight: "1.4"
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Credentials Required</strong>
                <p style={{ marginTop: "0.25rem", color: "var(--color-text-secondary)" }}>
                  Configure your Vercel Project environment variables or local `.env.local` to continue.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Right Hand: Provisioned Resources */}
        <section className={styles.panel} style={{ flexGrow: 1 }}>
          <div className={styles.panelTitle} style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Server size={18} color="var(--accent-secondary)" />
              <h2>Cloud Instances</h2>
            </div>
            {awsStatus?.configured && (
              <button 
                onClick={() => fetchInstances()} 
                className={styles.btnTerminate} 
                style={{ color: "var(--color-text-secondary)", borderColor: "var(--border-color)" }}
                disabled={loadingInstances}
                aria-label="Refresh instance list"
              >
                <RefreshCw size={12} style={{ animation: loadingInstances ? "spin 1.5s linear infinite" : "none" }} />
                Refresh
              </button>
            )}
          </div>

          <div className={styles.instanceList}>
            {loadingInstances && instances.length === 0 ? (
              <>
                <div className={styles.shimmer} />
                <div className={styles.shimmer} />
              </>
            ) : instances.length > 0 ? (
              instances.map((instance) => (
                <div key={instance.instanceId} className={styles.instanceCard}>
                  
                  {/* Card Title & Badges */}
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                      <span className={styles.instanceName}>{instance.name}</span>
                      <span className={styles.instanceId}>{instance.instanceId}</span>
                    </div>
                    
                    <span className={`${styles.badge} ${styles[instance.state] || ""}`}>
                      <span className={styles.badgeDot} />
                      {instance.state}
                    </span>
                  </div>

                  {/* Instance Grid specs */}
                  <div className={styles.cardGrid}>
                    <div className={styles.cardItem}>
                      <span className={styles.cardItemLabel}>Profile</span>
                      <span className={styles.cardItemVal}>{instance.instanceType}</span>
                    </div>
                    
                    <div className={styles.cardItem}>
                      <span className={styles.cardItemLabel}>Region</span>
                      <span className={styles.cardItemVal}>{region}</span>
                    </div>

                    <div className={styles.cardItem}>
                      <span className={styles.cardItemLabel}>IP Address</span>
                      <span className={`${styles.cardItemVal} ${styles.mono}`}>
                        {instance.publicIp ? (
                          <>
                            {instance.publicIp}
                            <button 
                              onClick={() => copySSHCommand(instance.publicIp!, instance.instanceId)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                              title="Copy SSH Command"
                            >
                              {copiedId === instance.instanceId ? (
                                <Check size={12} color="var(--color-success)" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </>
                        ) : (
                          "Allocation pending..."
                        )}
                      </span>
                    </div>

                    <div className={styles.cardItem}>
                      <span className={styles.cardItemLabel}>Launch Date</span>
                      <span className={styles.cardItemVal}>
                        {new Date(instance.launchTime).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Bottom details & Destroy actions */}
                  <div className={styles.cardActions}>
                    <div>
                      {instance.createdByApp ? (
                        <span className={styles.createdByBadge}>Creator App Instance</span>
                      ) : (
                        <span className={styles.helpText} style={{ fontSize: "0.6875rem" }}>Discovered EC2 Node</span>
                      )}
                    </div>

                    {instance.state !== "terminated" && instance.state !== "shutting-down" && (
                      <button 
                        onClick={() => handleTerminateInstance(instance.instanceId)}
                        className={styles.btnTerminate}
                        disabled={terminatingId === instance.instanceId}
                      >
                        {terminatingId === instance.instanceId ? (
                          <>
                            <Loader2 size={12} style={{ animation: "spin 1.5s linear infinite" }} />
                            Stopping...
                          </>
                        ) : (
                          <>
                            <Trash2 size={12} />
                            Terminate
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <Server size={32} />
                <div>
                  <strong>No Instances Discovered</strong>
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                    There are no compute instances running in the selected region. Fill out the console form to provision one.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Developer Log Console Drawer */}
      <footer className={styles.consolePanel}>
        <div className={styles.consoleHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Terminal size={14} />
            <span>Developer Console Logs</span>
          </div>
          <button 
            onClick={() => setLogs([])}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: "0.6875rem" }}
          >
            Clear Console
          </button>
        </div>
        <div className={styles.consoleContent}>
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className={styles.consoleLog}>
                <span className={styles.consoleLogTime}>[{log.time}]</span>
                <span>{log.message}</span>
              </div>
            ))
          ) : (
            <div style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>
              Console ready. Initializing logs...
            </div>
          )}
          <div ref={consoleEndRef} />
        </div>
      </footer>
    </div>
  );
}

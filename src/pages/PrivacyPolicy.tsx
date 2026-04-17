import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type PolicyBlock =
  | { type: "paragraph"; content: string }
  | { type: "list"; items: string[] }
  | { type: "subheading"; title: string }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
    };

type PolicySection = {
  id: string;
  title: string;
  blocks: PolicyBlock[];
};

const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "information-we-collect",
    title: "1. Information We Collect",
    blocks: [
      { type: "paragraph", content: "We collect information in the following categories in connection with JFO.AI, our website, and related services." },
      { type: "subheading", title: "1.1 Personal Information You Provide" },
      { type: "list", items: [
        "Account information, such as your name, email address, password, profile image, title, company name, and related profile details.",
        "Billing information, such as payment method details, billing address, and transaction history handled by third-party payment processors.",
        "Communications, such as support requests, feedback, and other messages you send to us."
      ]},
      { type: "subheading", title: "1.2 Workspace Data" },
      { type: "list", items: [
        "Organization and team data, including workspace names, roles, permissions, and settings.",
        "User-generated content, including prompts, task descriptions, documents, messages, notes, uploads, and related records."
      ]},
      { type: "subheading", title: "1.3 AI Interaction Data" },
      { type: "list", items: [
        "Prompts and instructions you provide to AI agents.",
        "Agent outputs, including responses, drafts, actions, and deliverables generated on your behalf.",
        "Conversation histories, task threads, feedback, tool logs, execution traces, and decision records."
      ]},
      { type: "subheading", title: "1.4 Connected Tool Data" },
      { type: "paragraph", content: "When you authorize integrations, we may process data from connected tools such as email, calendars, communication platforms, code repositories, document systems, and project management software to complete authorized tasks." },
      { type: "subheading", title: "1.5 Automatically Collected Information" },
      { type: "list", items: [
        "Device, browser, and operating system information.",
        "Usage data such as pages visited, features used, click patterns, session duration, and referring URLs.",
        "Log, diagnostic, and approximate location data inferred from IP address."
      ]},
    ],
  },
  {
    id: "how-we-use",
    title: "2. How We Process Your Information",
    blocks: [
      { type: "paragraph", content: "We process personal information to provide, secure, improve, and support JFO.AI and its related services." },
      { type: "list", items: [
        "Provide and operate the service, including account creation, workspace management, and AI task execution.",
        "Enable connected tool workflows and agent actions that you authorize.",
        "Improve system quality, reliability, product performance, and feature development.",
        "Send service notices, updates, and security communications; where permitted, marketing communications.",
        "Detect fraud, prevent abuse, maintain security, and comply with legal obligations.",
        "Conduct analytics, research, and customer support."
      ]},
    ],
  },
  {
    id: "legal-bases",
    title: "3. Legal Bases for Processing",
    blocks: [
      { type: "subheading", title: "3.1 EEA, United Kingdom, and Switzerland" },
      { type: "list", items: [
        "Performance of a contract.",
        "Legitimate interests, such as service improvement, analytics, fraud prevention, and security.",
        "Consent, where required for specific activities.",
        "Compliance with legal obligations."
      ]},
      { type: "subheading", title: "3.2 Canada" },
      { type: "list", items: [
        "Express or implied consent, except where law permits otherwise.",
        "Legitimate business purposes that are reasonable in the circumstances.",
        "Legal requirements under applicable privacy laws."
      ]},
    ],
  },
  {
    id: "sharing",
    title: "4. When and With Whom We Share Your Information",
    blocks: [
      { type: "list", items: [
        "Service providers supporting infrastructure, payments, analytics, communications, and support.",
        "AI model providers that power agent capabilities and process authorized prompts and context.",
        "Connected third-party services that you explicitly authorize agents to access.",
        "Acquirers or successor entities in a merger, acquisition, financing, reorganization, or sale.",
        "Law enforcement, regulators, courts, or other parties where disclosure is required or appropriate by law.",
        "Other parties where you have given explicit consent.",
        "Recipients of aggregated or de-identified information that cannot reasonably identify you."
      ]},
    ],
  },
  {
    id: "cookies",
    title: "5. Cookies and Tracking Technologies",
    blocks: [
      { type: "paragraph", content: "We and our service providers may use cookies, pixels, web beacons, and similar technologies to operate the service and understand usage." },
      { type: "list", items: [
        "Strictly necessary cookies for authentication, security, and core functionality.",
        "Analytics cookies for usage measurement and product improvement.",
        "Functional cookies that remember settings and preferences.",
        "Marketing cookies where legally permitted."
      ]},
      { type: "paragraph", content: "Most browsers allow you to control cookies through settings. Disabling cookies may affect functionality." },
    ],
  },
  {
    id: "social-logins",
    title: "6. Social Logins",
    blocks: [
      { type: "paragraph", content: "If JFO.AI offers social login options, we may receive profile information from the selected provider, such as your name, email address, and profile image, and use that information only as described in this Privacy Policy." },
    ],
  },
  {
    id: "ai-processing",
    title: "7. AI Data Processing",
    blocks: [
      { type: "paragraph", content: "This section explains how data is processed in connection with AI features, agents, and large language model capabilities used by JFO.AI." },
      { type: "subheading", title: "7.1 LLM Processing" },
      { type: "paragraph", content: "Prompts, instructions, workspace context, and relevant task data may be processed by AI systems to generate outputs, recommendations, and actions." },
      { type: "subheading", title: "7.2 Third-Party AI Providers" },
      { type: "list", items: [
        "We may use third-party AI providers, including providers of large language models and related AI infrastructure.",
        "Data sent to such providers may include prompts, interaction history, workspace context, and authorized connected-tool data needed for execution."
      ]},
      { type: "subheading", title: "7.3 Connected Services Access" },
      { type: "paragraph", content: "When you grant access to third-party services, AI agents may read, process, and act on data within those systems to the extent necessary to perform assigned tasks." },
      { type: "subheading", title: "7.4 Sensitive Data Warning" },
      { type: "paragraph", content: "Please use caution when sharing sensitive personal information, financial account data, government identifiers, health information, trade secrets, or highly confidential business information with AI agents." },
      { type: "subheading", title: "7.5 Retention of AI Logs" },
      { type: "paragraph", content: "Prompts, responses, conversation histories, and agent action logs may be retained in line with the retention periods described below, subject to legal and operational requirements." },
      { type: "subheading", title: "7.6 Deletion Rights" },
      { type: "paragraph", content: "You may request deletion of AI interaction data, including chat history, prompts, outputs, and action logs, subject to applicable exceptions." },
      { type: "subheading", title: "7.7 De-Identified Data for Improvement" },
      { type: "paragraph", content: "We may use de-identified, aggregated, or anonymized data derived from interactions with JFO.AI to improve service quality, model performance, and system reliability." },
    ],
  },
  {
    id: "international-transfers",
    title: "8. International Data Transfers",
    blocks: [
      { type: "paragraph", content: "Your information may be processed in jurisdictions outside your country of residence, including jurisdictions with different privacy laws." },
      { type: "list", items: [
        "Where required, we use appropriate transfer safeguards, such as Standard Contractual Clauses or other lawful transfer mechanisms.",
        "Data processed by third-party AI providers and service providers may also be subject to cross-border transfer arrangements."
      ]},
    ],
  },
  {
    id: "retention",
    title: "9. Data Retention",
    blocks: [
      { type: "list", items: [
        "Account information: retained while your account remains active and for a reasonable period thereafter.",
        "AI interaction data: retained for the duration of your account unless you request deletion earlier, subject to exceptions.",
        "Billing and transaction data: retained as required by applicable accounting, tax, and reporting laws.",
        "Usage and analytics data: retained for a limited period before aggregation or de-identification.",
        "Support communications: retained for internal support, audit, and quality assurance purposes."
      ]},
    ],
  },
  {
    id: "security",
    title: "10. Security",
    blocks: [
      { type: "paragraph", content: "We use technical and organizational measures intended to protect personal information, including access controls, encryption, monitoring, logging, security testing, and incident response processes." },
      { type: "paragraph", content: "No internet transmission or storage system is completely secure, and we cannot guarantee absolute security." },
    ],
  },
  {
    id: "privacy-rights",
    title: "11. Privacy Rights",
    blocks: [
      { type: "subheading", title: "11.1 EEA, United Kingdom, and Switzerland" },
      { type: "list", items: [
        "Right of access.",
        "Right to rectification.",
        "Right to erasure.",
        "Right to restriction of processing.",
        "Right to data portability.",
        "Right to object.",
        "Right to withdraw consent.",
        "Right to lodge a complaint with a supervisory authority."
      ]},
      { type: "subheading", title: "11.2 United States — State Privacy Rights" },
      { type: "list", items: [
        "Right to know or access personal information.",
        "Right to delete.",
        "Right to correct.",
        "Right to opt out where applicable.",
        "Right to non-discrimination.",
        "Right to data portability."
      ]},
      { type: "subheading", title: "11.3 CCPA Categories of Personal Information" },
      {
        type: "table",
        headers: ["Category", "Examples", "Collected", "Disclosed", "Sold/Shared"],
        rows: [
          ["Identifiers", "Name, email, IP address, account name", "Yes", "Yes", "No"],
          ["Customer records", "Name, address, payment details", "Yes", "Yes", "No"],
          ["Commercial information", "Transaction and subscription history", "Yes", "Yes", "No"],
          ["Internet activity", "Browsing, feature use, usage data", "Yes", "Yes", "No"],
          ["Geolocation data", "Approximate location from IP", "Yes", "Yes", "No"],
          ["Professional information", "Job title, company name", "Yes", "No", "No"],
          ["Inferences", "Preferences and usage patterns", "Yes", "No", "No"],
        ],
      },
      { type: "paragraph", content: "We do not sell your personal information." },
    ],
  },
  {
    id: "minors",
    title: "12. Minors",
    blocks: [
      { type: "paragraph", content: "JFO.AI is not intended for individuals under 18, and we do not knowingly collect personal information from minors." },
    ],
  },
  {
    id: "dnt",
    title: "13. Do-Not-Track Signals",
    blocks: [
      { type: "paragraph", content: "Because there is no universally accepted standard for responding to Do-Not-Track browser signals, JFO.AI does not currently respond to such signals." },
    ],
  },
  {
    id: "updates",
    title: "14. Updates to This Privacy Policy",
    blocks: [
      { type: "paragraph", content: "We may update this Privacy Policy from time to time to reflect changes in product functionality, legal requirements, or business practices. When we do, we will update the effective date and provide additional notice where required by law." },
    ],
  },
  {
    id: "contact",
    title: "15. Contact Us",
    blocks: [
      { type: "paragraph", content: "If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us through the official contact channels listed on JFO.AI." },
    ],
  },
  {
    id: "manage-data",
    title: "16. How to Review, Update, or Delete Your Data",
    blocks: [
      { type: "list", items: [
        "Review and update account information through account or profile settings where available.",
        "Manage AI interaction history and related records through applicable product controls where available.",
        "Review and revoke permissions for connected tools through account and integration settings.",
        "Submit an access, correction, export, or deletion request through our official support or privacy contact channels."
      ]},
    ],
  },
];

function PolicyContent({ block }: { block: PolicyBlock }) {
  if (block.type === "paragraph") {
    return <p className="text-sm leading-relaxed text-muted-foreground">{block.content}</p>;
  }

  if (block.type === "subheading") {
    return <h3 className="mb-2 text-sm font-semibold text-foreground">{block.title}</h3>;
  }

  if (block.type === "list") {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {block.headers.map((header) => (
              <th key={header} className="py-2 pr-4 text-left text-xs font-medium text-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {block.rows.map((row) => (
            <tr key={row[0]} className="border-b border-border last:border-0">
              {row.map((cell, index) => (
                <td key={`${row[0]}-${index}`} className="py-2 pr-4 align-top text-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderSectionBlocks(blocks: PolicyBlock[]) {
  const content: ReactNode[] = [];
  let pendingHeading: string | null = null;
  let pendingBlocks: PolicyBlock[] = [];

  const flushGroup = (key: string) => {
    if (!pendingHeading && pendingBlocks.length === 0) return;

    if (pendingHeading) {
      content.push(
        <div key={key} className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">{pendingHeading}</h3>
          <div className="space-y-3">
            {pendingBlocks.map((block, index) => (
              <PolicyContent key={`${key}-${index}`} block={block} />
            ))}
          </div>
        </div>
      );
    } else {
      pendingBlocks.forEach((block, index) => {
        content.push(<PolicyContent key={`${key}-${index}`} block={block} />);
      });
    }

    pendingHeading = null;
    pendingBlocks = [];
  };

  blocks.forEach((block, index) => {
    if (block.type === "subheading") {
      flushGroup(`group-${index}`);
      pendingHeading = block.title;
      return;
    }

    pendingBlocks.push(block);
  });

  flushGroup("group-final");
  return content;
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/[0.06] bg-[hsl(240_43%_5%/0.94)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 md:px-10 lg:px-12">
          <Link to="/" className="font-display text-[1.05rem] font-semibold tracking-[0.08em] text-gradient-landing">
            合域
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-sky-400/30 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回首页
          </Link>
        </div>
      </header>

      <main className="pt-[60px]">
        <div className="border-b border-border py-16 px-6">
          <div className="mx-auto max-w-3xl">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground/80">Legal</p>
            <h1 className="mb-3 font-display text-[clamp(28px,3vw,44px)] font-semibold leading-tight tracking-tight text-foreground">
              Privacy Policy
            </h1>
            <p className="text-sm text-muted-foreground/80">Last Updated: March 6, 2026</p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-6 py-16">
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
            This Privacy Policy describes how JFO.AI collects, uses, stores, shares, and otherwise processes personal information in connection with our website, products, AI agent workflows, and related services.
          </p>
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
            By accessing or using the Services, you acknowledge that you have read and understood this Privacy Policy. If you do not agree with our practices, please do not use the Services.
          </p>
          <div className="mt-8 border-t border-border" />

          {POLICY_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="mb-2 scroll-mt-24">
              <h2 className="mb-4 mt-10 text-base font-semibold text-foreground">{section.title}</h2>
              {renderSectionBlocks(section.blocks)}
              <div className="mt-10 border-t border-border" />
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

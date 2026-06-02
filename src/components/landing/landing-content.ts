import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Brain,
  Database,
  FileInput,
  GitBranch,
  Layers,
  MessageSquare,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

export const TRUST_ITEMS = [
  { icon: Layers, label: "多源接入" },
  { icon: Database, label: "智库 Schema" },
  { icon: Shield, label: "分级脱敏" },
  { icon: GitBranch, label: "方案组合" },
  { icon: MessageSquare, label: "Master Agent" },
  { icon: Zap, label: "端到端可用" },
] as const;

export const CAPABILITIES = [
  { label: "输入层", text: "语音、文字、文件统一接入" },
  {
    label: "数据处理",
    text: "非结构化→智库Schema；自动归档项目/家族；缺失字段回问；冲突标记",
  },
  {
    label: "权限隔离",
    text: "四级权限体系，权限引擎实时过滤，逐层收敛信息粒度",
  },
  {
    label: "输出",
    text: "可签约方案路径、项目知识模块、方案地图与竞争评分报告",
  },
] as const;

export const PIPELINE = [
  {
    step: "01",
    tag: "Ingest",
    title: "统一接入",
    desc: "语音、文字、文件入库与撰写",
    icon: FileInput,
  },
  {
    step: "02",
    tag: "Schema",
    title: "结构化智库",
    desc: "非结构化 → 智库字段；归档项目与家族；缺失回问",
    icon: BookOpen,
  },
  {
    step: "03",
    tag: "Decide",
    title: "分析辅助",
    desc: "方案组合与多维度评分草稿，AI辅助，核心团队确认",
    icon: Brain,
  },
  {
    step: "04",
    tag: "Output",
    title: "可签约输出",
    desc: "路径说明、方案地图与竞争评分报告",
    icon: Sparkles,
  },
] as const;

export type ScrollChapter = {
  id: string;
  index: string;
  label: string;
  folio: string;
  title: string;
  subtitle?: string;
  body: string;
  start: number;
  end: number;
};

export const SCROLL_CHAPTERS: ScrollChapter[] = [
  {
    id: "welcome",
    index: "00",
    label: "Welcome",
    folio: "Welcome",
    title: "合域AI",
    subtitle: "联合家族办公室投资智库",
    body: "以 AI Agent 为引擎的多家族联合投资决策辅助系统。从信息输入到签约方案输出，全链路权限隔离。",
    start: 0,
    end: 0.2,
  },
  {
    id: "capabilities",
    index: "01",
    label: "Capabilities",
    folio: "Capabilities",
    title: "平台能力",
    subtitle: "为家办场景深度构建",
    body: "输入、处理、分析、决策链路清晰可演示，每个功能模块都围绕真实需求设计。",
    start: 0.2,
    end: 0.4,
  },
  {
    id: "flow",
    index: "02",
    label: "Flow",
    folio: "Flow",
    title: "端到端链路",
    subtitle: "从接入到可签约输出",
    body: "统一接入 → 结构化智库 → 分析辅助 → 可签约输出。",
    start: 0.4,
    end: 0.6,
  },
  {
    id: "knowledge",
    index: "03",
    label: "Knowledge",
    folio: "Knowledge base",
    title: "智库——对话即服务",
    body: "不再需要翻阅报告、等待回复。用户用自己的语言提出问题，平台从知识库中检索、整合并生成回答——每一条信息都可溯源至原始文档。",
    start: 0.6,
    end: 0.8,
  },
  {
    id: "contact",
    index: "04",
    label: "Contact",
    folio: "Contact",
    title: "联系与演示",
    body: "预约产品演示，或下载产品手册。合域 · 联合家办平台。",
    start: 0.8,
    end: 1.01,
  },
];

export type { LucideIcon };

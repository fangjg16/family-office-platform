/** 项目状态（英文标签 + 中文说明） */
export type ProjectPhase =
  | "Active（资源筹备中）"
  | "Completed（已签约）"
  | "Paused（暂停）"
  | "Cancelled（已取消）";

export type WorkspaceProject = {
  id: string;
  name: string;
  category: string;
  phase: ProjectPhase;
  /** 总览卡片摘要（含可量化信息，供非 Guest 角色） */
  summary: string;
  /** Guest 在卡片上仅见该句（不含具体机构/金额） */
  guestSummary: string;
};

/** 全平台共 12 个在管项目 */
export const ALL_PROJECTS: WorkspaceProject[] = [
  {
    id: "shrimp",
    name: "白虾供应链联合投资",
    category: "食品农业",
    phase: "Active（资源筹备中）",
    summary:
      "厄瓜多尔白虾 FOB + 华东冷链；华南资本 3,000 万已确认，远东集团 4,000 万意向函在途。",
    guestSummary:
      "南美对虾跨境供应链，多路资金与冷链环节对齐中，详情按权限展开。",
  },
  {
    id: "natgeo-rwa",
    name: "国家地理濒危物种 IP 数字货币项目",
    category: "数字资产 / IP",
    phase: "Active（资源筹备中）",
    summary:
      "民生系高层对接国家地理 IP；濒危动植物主题数字发行预计总盘子数亿元，发行结构与授权边界进入法务与合规联审。",
    guestSummary:
      "文化 IP 与数字发行项目已立项推进，资金与合规路径按权限展示。",
  },
  {
    id: "europe-hotel-ma",
    name: "欧洲精品酒店收购",
    category: "酒店 / 旅游",
    phase: "Active（资源筹备中）",
    summary:
      "南欧精品酒店组合收购已纳入并购管线；标的清单与估值模型随尽调推进持续更新。",
    guestSummary:
      "欧洲酒店类资产项目在管推进中，具体国家与交易结构按权限展示。",
  },
  {
    id: "coastal-estate",
    name: "滨海城市更新地产基金",
    category: "地产",
    phase: "Active（资源筹备中）",
    summary:
      "滨海核心区旧改 SPV；评估约 2.6 亿，海通资管劣后意向 1.1–1.3 亿条款谈判中。",
    guestSummary:
      "城市更新类持有资产，配资与征拆双线推进，详情按权限展开。",
  },
  {
    id: "cross-trade",
    name: "跨境大宗贸易周转",
    category: "贸易",
    phase: "Active（资源筹备中）",
    summary:
      "南美大豆 + 棕榈油 LC 周转；本期信用证约 ¥1.18 亿，在途三笔、一批待补检验。",
    guestSummary:
      "跨境大宗信用证与在途货权结构，单证与授信按权限展示。",
  },
  {
    id: "digital-portal",
    name: "家族数字化门户",
    category: "数字化",
    phase: "Paused（暂停）",
    summary:
      "门户一期未达验收；神州数码实施 + 阿里云，合同 ¥280 万已付 30%，等保测评换签重提。",
    guestSummary:
      "家族统一门户与安全评审暂停，恢复时间视测评结论而定。",
  },
  {
    id: "ip-invest",
    name: "文娱 IP 投资联合体",
    category: "文娱 / IP",
    phase: "Cancelled（已取消）",
    summary:
      "主投视频平台书面终止；已付定金 ¥800 万进入仲裁，项目侧不再承接新业务。",
    guestSummary:
      "文娱 IP 联合投资已终止，历史材料仅供内部审计追溯。",
  },
  {
    id: "hk-us-equity",
    name: "港美二级市场专户",
    category: "证券",
    phase: "Active（资源筹备中）",
    summary:
      "中行（香港）托管 + 华泰/IB；港美组合约 ¥2.05 亿等值，近期波动率预警已处理。",
    guestSummary:
      "港美多资产专户，持仓与策略细节按权限与合规要求展示。",
  },
  {
    id: "energy-ma",
    name: "新能源并购储备池",
    category: "能源",
    phase: "Completed（已签约）",
    summary:
      "苏北 120MW 地面电站已签约；产业方 2 亿对赌发电量，已并网 78MW，补贴目录申报中。",
    guestSummary:
      "新能源电站并购已进入投后，并网与补贴进度按权限展示。",
  },
  {
    id: "med-channel",
    name: "医疗器械渠道整合",
    category: "医疗",
    phase: "Active（资源筹备中）",
    summary:
      "华东经销 + 微创心脉区域总代；进院 42 家，集采降价压力下重算渠道毛利。",
    guestSummary:
      "医疗器械渠道整合，进院与集采进度按权限展示。",
  },
  {
    id: "offshore-trust",
    name: "离岸信托架构优化",
    category: "法务 / 架构",
    phase: "Active（资源筹备中）",
    summary:
      "BVI Ocean Ridge + 香港中间层；CRS 与经济实质材料补档，受益分配触发待法审闭合。",
    guestSummary:
      "离岸控股与信托层优化，受益人及路径信息高度敏感、按权限展示。",
  },
  {
    id: "edu-ma",
    name: "职业教育资产并购",
    category: "教育",
    phase: "Active（资源筹备中）",
    summary:
      "华东职教集团 E 估值约 3.5 亿；并购基金意向 1.5 亿，地方国资 8,000 万混改谈判中。",
    guestSummary:
      "职业教育标的并购与混改配套，尽调与对赌条款按权限展示。",
  },
];

export const TOTAL_PROJECT_COUNT = ALL_PROJECTS.length;

export function getProjectById(id: string): WorkspaceProject | undefined {
  return ALL_PROJECTS.find((p) => p.id === id);
}

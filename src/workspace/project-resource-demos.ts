type Row4 = [string, string, string, string];

export type ProjectRankingPlan = {
  rank: number;
  name: string;
  score: number;
  rec: boolean;
};

/** Mid 专用：多轮追问（可与单条 credibilityUserLineMid 二选一；有则优先用本序列） */
export type MidFollowUpStep =
  | {
      kind: "credibility";
      /** 用户气泡 */
      userLine: string;
      /** 对用户句中多问的逐条定性回答，再进入下方「可信度检测报告」卡片 */
      summaryLines?: string[];
    }
  | {
      kind: "refusal";
      userLine: string;
      body: string;
    }
  | {
      /** 非「可信度表」类的一般说明（可与 credibility / refusal 任意组合） */
      kind: "text";
      userLine: string;
      title?: string;
      body: string;
      /** 选填：与输入区一致的发送附件面板（演示） */
      attachments?: readonly { name: string }[];
    };

/** 对话区与「核心资源」表配套的文案 */
export type ProjectChatSnippet = {
  /** Admin/Core：可追问具体主体与精确口径 */
  credibilityUserLine: string;
  /** Mid：单轮追问（未配置 midFollowUp 时使用） */
  credibilityUserLineMid: string;
  /** 若配置，则 Mid 按多轮渲染（追问类型不必与「可信度」相同） */
  midFollowUp?: MidFollowUpStep[];
  /** Low：不涉及具体主体名与金额 */
  credibilityUserLineLow: string;
  sidebarPreview: string;
  credibilityTitleCore: string;
  credibilityTitleSecondary: string;
  rankingPlansCore: [ProjectRankingPlan, ProjectRankingPlan, ProjectRankingPlan];
  rankingPlansSecondary: [
    ProjectRankingPlan,
    ProjectRankingPlan,
    ProjectRankingPlan,
  ];
  rankingBullets: [string, string, string];
  /**
   * Core/Admin（full 档）：在「可信度追问」前插入的演示轮次——用户补充意向、上传材料等。
   * 由对话页在资源表之后渲染。
   */
  supplyExchanges?: readonly {
    userLine: string;
    aiBody: string;
    attachments?: readonly { name: string }[];
    /** 先由 Agent 复述待办并请用户确认，再落库为 aiBody */
    confirmation?: {
      agentPrompt: string;
      userConfirmLine: string;
    };
  }[];
};

export type ProjectResourceDemo = {
  coreRows: [Row4, Row4, Row4];
  secondaryRows: [Row4, Row4, Row4];
  brokerRows: [Row4, Row4, Row4, Row4];
  coreWarn: string;
  secondaryWarn: string;
  brokerWarn: string;
  chat: ProjectChatSnippet;
};

const SHRIMP_CHAT: ProjectChatSnippet = {
  credibilityUserLine: "远东集团的 4,000 万可信度如何？",
  credibilityUserLineMid:
    "参与方甲 2,500–3,500 万这个区间，更靠近下限还是上限？参与方乙 3,500–4,500 万这条「意向为主」，风险等级大致怎么理解？",
  midFollowUp: [
    {
      kind: "credibility",
      userLine:
        "参与方甲 2,500–3,500 万这个区间，更靠近下限还是上限？参与方乙 3,500–4,500 万这条「意向为主」，风险等级大致怎么理解？",
      summaryLines: [
        "关于参与方甲区间：Mid 仅掌握**区间带**，可理解为对价意图落在该带宽内，**不能**在 Mid 中回答「更靠近下限还是上限」的精确落点；需以核心底稿为准。",
        "关于参与方乙：在「意向为主」前提下，可理解为**大额意向尚未闭合**，华东冷链为资源侧重；不宜在 Mid 中收窄为具体企业实名。",
        "关于风险等级：结合表内已确认/意向/理论混合状态，**综合定性为中等**；具体分值与折算见下方报告（数值字段对 Mid 隐藏）。",
      ],
    },
    {
      kind: "refusal",
      userLine:
        "坊间传言里提到的那家大集团，有没有可能对应参与方乙？",
      body:
        "您当前为 Mid 权限，无法将市场传言与表中代号（如参与方乙）做实名对应或核实「是否同一家」；涉及具体集团名称与真实身份映射，仅 Admin/Core 在合规流程内可见。",
    },
  ],
  credibilityUserLineLow:
    "在当前权限下只能看到环节是否覆盖，想了解一下：资金门槛与整体可信度结论应如何理解？",
  sidebarPreview: "已生成资源配置表与方案排名草稿…",
  credibilityTitleCore: "远东集团",
  credibilityTitleSecondary: "参与方乙",
  rankingPlansCore: [
    { rank: 1, name: "华南资本 + 远东集团 + 海湾信达", score: 82, rec: true },
    { rank: 2, name: "华南资本 + 远东集团", score: 71, rec: false },
    { rank: 3, name: "远东集团 + 海湾信达", score: 64, rec: false },
  ],
  rankingPlansSecondary: [
    { rank: 1, name: "参与方甲 + 参与方乙 + 参与方丙", score: 82, rec: true },
    { rank: 2, name: "参与方甲 + 参与方乙", score: 71, rec: false },
    { rank: 3, name: "参与方乙 + 参与方丙", score: 64, rec: false },
  ],
  rankingBullets: [
    "优先推动「已确认资金」落账，缩小与 8,000 万门槛差距。",
    "对「意向」资金准备备用方案，避免单一依赖大额口头承诺。",
    "渠道环节建议锁定 1 家主合作方，降低协调成本（竞争与评估规则）。",
  ],
};

const NATGEO_RWA_CHAT: ProjectChatSnippet = {
  credibilityUserLine:
    "民生系资源方提出的「数亿级」意向，在 IP 授权与发行路径未闭环前应如何折算可信度？",
  credibilityUserLineMid:
    "数亿级资金，更偏项目总对价还是承销与通道包？国家地理 IP 侧是独家还是区域授权？合规与政策风险怎么理解？",
  midFollowUp: [
    {
      kind: "credibility",
      userLine:
        "数亿级资金，更偏项目总对价还是承销与通道包？国家地理 IP 侧是独家还是区域授权？合规与政策风险怎么理解？",
      summaryLines: [
        "关于「数亿」口径：Mid 仅记录为**量级带**，**不能**在 Mid 中拆成「总对价 vs 通道费」的精确结构；以核心级备忘录与书面条款为准。",
        "关于 IP 授权：可理解为**独家/区域/主题拆分仍在谈判**，不宜在 Mid 中认定为已锁定独家。",
        "关于合规与政策：涉及文化 IP、数字权益与可能的跨境资金安排，**综合风险定性为中高**；与下方报告一致（数值隐藏）。",
      ],
    },
    {
      kind: "refusal",
      userLine: "能否确认某位民生银行高层就是资源方本人？",
      body:
        "您当前为 Mid 权限，无法核实具体金融机构任职人员与项目资源方的实名对应；涉及个人身份与职务映射，仅 Admin/Core 在合规流程内处理。",
    },
  ],
  credibilityUserLineLow:
    "在当前权限下能否概括：该项目涉及 IP、数字发行与资金通道时的整体可信度与合规风险？",
  sidebarPreview: "IP 授权与发行路径草案待合规评审…",
  credibilityTitleCore: "民生系资源方",
  credibilityTitleSecondary: "IP 合作方乙",
  rankingPlansCore: [
    {
      rank: 1,
      name: "家族 SPV + 持牌技术合作方 + 公益背书机构",
      score: 76,
      rec: true,
    },
    {
      rank: 2,
      name: "家族 SPV + 持牌技术合作方",
      score: 64,
      rec: false,
    },
    { rank: 3, name: "持牌技术合作方 + IP 合作方乙", score: 58, rec: false },
  ],
  rankingPlansSecondary: [
    {
      rank: 1,
      name: "资金方甲 + 发行合作方乙 + 生态顾问丙",
      score: 76,
      rec: true,
    },
    { rank: 2, name: "资金方甲 + 发行合作方乙", score: 64, rec: false },
    { rank: 3, name: "发行合作方乙 + 生态顾问丙", score: 58, rec: false },
  ],
  rankingBullets: [
    "优先取得国家地理 IP 可审计授权链与主题范围书面确认，再谈资金承诺。",
    "将「数亿」拆分为承销、技术与品牌费用，避免与证券发行特征混淆。",
    "在监管路径未清前，控制对外宣传与募资口径，避免触发合规红线。",
  ],
};

const EUROPE_HOTEL_MA_CHAT: ProjectChatSnippet = {
  supplyExchanges: [
    {
      userLine:
        "补充：家族拟通过并购 SPV 牵头推进「欧洲精品酒店收购」，先书面表达参与意向——希望优先关注南欧核心城市带，并按内部节奏尽快进入材料与评审环节。",
      confirmation: {
        agentPrompt:
          "理解为：您希望由并购 SPV 牵头推进「欧洲精品酒店收购」，优先关注南欧核心城市带；并希望按内部节奏尽快进入材料与评审环节。确认后，我将把本条写入「需求与假设」字段，并据此准备 IC 材料清单与时间表建议草案。\n\n以上理解是否准确？请回复「确认」或「是的」。",
        userConfirmLine: "确认，请按此写入。",
      },
      aiBody:
        "已记录意向表述与优先级偏好，并写入本项目「需求与假设」字段。后续将结合标的池筛选结果，推送 IC 材料清单与时间表建议；您可随时覆写本条或追加说明。",
    },
    {
      userLine: "三个文件发过去了，麻烦收一下并入库。",
      aiBody:
        "以下文件已入库：①《葡西酒店市场速览（内部调研）》PDF；② 初筛标的清单（含钥匙数、ADR 区间）；③ 交易节奏草案（一页纸）。\n\n已完成解析，关键字段（城市带、资产形态、区间指标）已回填至智库 Schema；与历史版本不一致处已打标，请在后续对话中逐项确认或授权覆盖。",
      attachments: [
        { name: "葡西酒店市场速览（内部调研）.pdf" },
        { name: "初筛标的清单.xlsx" },
        { name: "交易节奏草案.pdf" },
      ],
    },
  ],
  credibilityUserLine: "南欧精品酒店标的池整体意向的可信度如何？",
  credibilityUserLineMid:
    "标的池是更偏资产收购还是股权收购？估值区间有没有内部假设？与家族流动性怎么衔接？",
  midFollowUp: [
    {
      kind: "text",
      userLine: "上面两个文件刚发了，帮忙收一下看能不能入库。",
      title: "入库回执",
      body:
        "以下文件已入库：①《葡西酒店市场速览（内部调研）》PDF；② 初筛标的清单（含钥匙数、ADR 区间）。\n\nMid 可见：已生成条目级摘要并完成字段标签回填；完整原文与敏感字段仍不对 Mid 展开。若需继续补充，请使用脱敏后的文件名与摘要级描述。",
      attachments: [
        { name: "葡西酒店市场速览（内部调研）.pdf" },
        { name: "初筛标的清单.xlsx" },
      ],
    },
    {
      kind: "text",
      userLine:
        "标的池是更偏资产收购还是股权收购？估值区间有没有内部假设？与家族流动性怎么衔接？",
      title: "追问要点 · 定性说明",
      body:
        "关于收购形态：当前进入并购筹备阶段，Mid 不判断「资产 vs 股权」单一路径；以专项法税模型为准。关于估值：内部有敏感性假设，**不对 Mid 展示数值区间**。关于流动性：与家族现金与负债方案正在对齐，**综合风险定性为中等偏谨慎**；正式评级待 IC 材料齐备。",
    },
    {
      kind: "refusal",
      userLine: "传言里提到的某家南欧酒店集团，是不是就是标的池里的那一家？",
      body:
        "您当前为 Mid 权限，无法将市场传言中的酒店集团与内部「标的池」代号做实名对应；具体酒店名称与交易文件仅 Admin/Core。",
    },
  ],
  credibilityUserLineLow:
    "在当前权限下，能否概括该欧洲酒店项目的整体阶段与主要不确定性？",
  sidebarPreview: "南欧标的池推进中，尽调与 FA 任命排期中…",
  credibilityTitleCore: "南欧标的池",
  credibilityTitleSecondary: "家族并购 SPV",
  rankingPlansCore: [
    {
      rank: 1,
      name: "家族并购 SPV + 当地律所 + 欧洲酒店运营合伙人",
      score: 72,
      rec: true,
    },
    {
      rank: 2,
      name: "家族并购 SPV + 当地律所",
      score: 61,
      rec: false,
    },
    {
      rank: 3,
      name: "当地律所 + 欧洲酒店运营合伙人",
      score: 54,
      rec: false,
    },
  ],
  rankingPlansSecondary: [
    {
      rank: 1,
      name: "标的池甲 + 家族 SPV + 顾问丙",
      score: 72,
      rec: true,
    },
    { rank: 2, name: "标的池甲 + 家族 SPV", score: 61, rec: false },
    { rank: 3, name: "家族 SPV + 顾问丙", score: 54, rec: false },
  ],
  rankingBullets: [
    "启动前先指定独家 FA 与跨境税筹顾问，避免多头询价导致估值失真。",
    "按并购项目标准维护推进节奏与资料版本，避免组合评分被低质量信息干扰。",
    "注意与家族整体流动性及授信预算衔接，避免收购期现金占用过度集中。",
  ],
};

/** 各项目「核心资源」表数据（与项目领域大致对应） */
const DEMOS: Record<string, ProjectResourceDemo> = {
  shrimp: {
    coreRows: [
      ["华南资本", "3,000 万", "已确认", "厄瓜多尔直采、渠道线索"],
      ["远东集团", "4,000 万", "意向（意向函）", "自有冷链"],
      ["海湾信达", "1,500 万", "理论", "国内分销渠道"],
    ],
    secondaryRows: [
      ["参与方甲", "2,500–3,500 万", "已确认/混合", "南美货源、渠道线索"],
      ["参与方乙", "3,500–4,500 万", "意向为主", "冷链（华东）"],
      ["参与方丙", "区间隐藏", "理论", "区域渠道"],
    ],
    brokerRows: [
      ["货源环节", "—", "已覆盖", "—"],
      ["冷链环节", "—", "已覆盖", "—"],
      ["渠道环节", "—", "部分覆盖", "—"],
      ["资金门槛", "—", "未达 8,000 万门槛", "—"],
    ],
    coreWarn:
      "提示：当前已确认实缴合计约 5,700 万，仍低于项目资金门槛 8,000 万，需补充已确认资金或调整方案。",
    secondaryWarn:
      "提示：综合区间测算后，已确认资金仍可能低于项目门槛，具体以核心级原文为准。",
    brokerWarn:
      "提示：资金环节尚未满足项目启动门槛，请联系核心对接人获取细节。",
    chat: SHRIMP_CHAT,
  },

  "natgeo-rwa": {
    coreRows: [
      [
        "合域家族办公室",
        "发起",
        "已确认",
        "战略发起、跨行业组合（食品 / 地产 / 数字）",
      ],
      [
        "民生系资源方",
        "—",
        "意向（高层对接）",
        "国家地理 IP、资金通道与监管沟通资源",
      ],
      [
        "国家地理（IP 授权）",
        "—",
        "谈判中",
        "濒危物种/植物主题、全球发行权范围未定",
      ],
    ],
    secondaryRows: [
      ["资金方甲", "数亿级", "意向/混合", "承销、通道与配资口径拆分中"],
      ["发行合作方乙", "区间隐藏", "意向", "牌照、链上基础设施与合规"],
      ["生态顾问丙", "—", "理论", "公益叙事与保护组织背书"],
    ],
    brokerRows: [
      ["IP 与品牌授权", "—", "部分覆盖", "—"],
      ["合规与监管口径", "—", "未闭合", "—"],
      ["跨境资金与支付", "—", "待方案", "—"],
      ["书面意向与 IC 材料", "—", "未齐备", "—"],
    ],
    coreWarn:
      "提示：当前「数亿」尚未拆分为项目总对价、承销费或技术采购；在条款确认前勿按已确认资金计入评分。",
    secondaryWarn:
      "提示：IP 独家性、主题范围与跨境发行路径仍在谈判，二级用户所见为代号与区间。",
    brokerWarn:
      "提示：涉及文化 IP、数字权益与银行资源，敏感度高；仅展示环节状态摘要。",
    chat: NATGEO_RWA_CHAT,
  },

  "europe-hotel-ma": {
    coreRows: [
      [
        "南欧精品酒店标的池",
        "—",
        "筛选中",
        "南欧酒店组合池，条款与估值同步推进",
      ],
      ["家族并购 SPV", "—", "意向", "跨境收购架构、税筹与贷款安排"],
      ["当地合作律所", "—", "意向", "产权、劳动法与酒店管理合同"],
    ],
    secondaryRows: [
      ["标的池甲", "—", "筛选中", "葡/西若干城市、精品酒店组合"],
      ["家族 SPV 乙", "—", "意向", "控股与融资路径"],
      ["顾问丙", "—", "理论", "运营合伙人引入"],
    ],
    brokerRows: [
      ["标的验证", "—", "推进中", "—"],
      ["跨境并购结构", "—", "方案编制中", "—"],
      ["流动性衔接", "—", "评审中", "—"],
      ["融资与持有期现金流", "—", "对齐中", "—"],
    ],
    coreWarn:
      "提示：项目处于前期并购推进阶段，FA 与尽调团队已进入任命流程；关键数据仍在持续补齐。",
    secondaryWarn:
      "提示：南欧区域与酒店数量均为内部假设，二级以代号与区间呈现，以核心底稿为准。",
    brokerWarn:
      "提示：中介级仅见阶段进度；具体国家、酒店与报价不对外展示。",
    chat: EUROPE_HOTEL_MA_CHAT,
  },

  "coastal-estate": {
    coreRows: [
      ["滨江控股", "2.5 亿", "已确权", "核心区旧改地块、征收进度正常"],
      ["海通资管", "约 1.8 亿", "评审中", "劣后配资、税筹结构已出草案"],
      ["城更母基金", "8,000 万", "已确认", "政府引导、跟投条款谈判中"],
    ],
    secondaryRows: [
      ["持有方甲", "区间 2–3 亿", "确权/混合", "核心区、容积率待批"],
      ["配资方乙", "约亿级", "意向为主", "劣后与回购条件"],
      ["参与方丙", "区间隐藏", "理论", "征收补偿与过渡安置"],
    ],
    brokerRows: [
      ["土地确权", "—", "已满足", "—"],
      ["征拆与补偿", "—", "推进中", "—"],
      ["配资与监管", "—", "部分满足", "—"],
      ["资金闭合", "—", "未达方案书门槛", "—"],
    ],
    coreWarn:
      "提示：配资比例与土地出让金缴纳节奏需满足属地监管要求，当前缺口主要在劣后实缴。",
    secondaryWarn:
      "提示：估值与对价区间存在敏感性，二级用户所见为区间与代号，以核心级底稿为准。",
    brokerWarn:
      "提示：公开渠道仅展示环节状态；具体对价与主体身份请通过核心对接人申请。",
    chat: {
      credibilityUserLine: "海通资管的约 1.8 亿劣后配资可信度如何？",
      credibilityUserLineMid:
        "持有方甲的 2–3 亿区间，更趋近 2 亿还是 3 亿？配资方乙『约亿级』能否再理解成偏一亿中后段还是两亿左右？风险等级大致怎么理解？",
      midFollowUp: [
        {
          kind: "credibility",
          userLine:
            "持有方甲的 2–3 亿区间，更趋近 2 亿还是 3 亿？配资方乙『约亿级』能否再理解成偏一亿中后段还是两亿左右？风险等级大致怎么理解？",
          summaryLines: [
            "关于持有方甲（2–3 亿区间）：在 Mid 口径下**不能**回答「更接近 2 亿还是 3 亿」的单点数值；仅可理解为**区间型对价/估值带**，具体落点以核心底稿为准。",
            "关于配资方乙「约亿级」：**仅表示亿元量级带**，不在 Mid 中展开为「一亿中后段还是近两亿」；具体劣后金额与批复细节不对 Mid 展示。",
            "关于风险等级：结合确权/混合状态与资金闭合压力，**综合定性为中等**；与下方报告一致（评分与系数对 Mid 隐藏）。",
          ],
        },
        {
          kind: "refusal",
          userLine:
            "市场传言会点名海通资管，能否帮忙核实有没有这家机构参与劣后？",
          body:
            "您当前为 Mid 权限，无法核实具体金融机构是否参与、是否与表中代号「配资方乙」为同一主体；劣后金额与机构实名仅 Admin/Core 在受控流程下可见。",
        },
      ],
      credibilityUserLineLow:
        "配资与资金闭合相关环节，在当前权限下能否给出整体可信度与风险的定性说明？",
      sidebarPreview: "旧改配资与征拆节奏已对齐，待闭合资金…",
      credibilityTitleCore: "海通资管",
      credibilityTitleSecondary: "配资方乙",
      rankingPlansCore: [
        {
          rank: 1,
          name: "滨江控股 + 海通资管 + 城更母基金",
          score: 84,
          rec: true,
        },
        { rank: 2, name: "滨江控股 + 海通资管", score: 73, rec: false },
        { rank: 3, name: "海通资管 + 城更母基金", score: 66, rec: false },
      ],
      rankingPlansSecondary: [
        { rank: 1, name: "持有方甲 + 配资方乙 + 参与方丙", score: 84, rec: true },
        { rank: 2, name: "持有方甲 + 配资方乙", score: 73, rec: false },
        { rank: 3, name: "配资方乙 + 参与方丙", score: 66, rec: false },
      ],
      rankingBullets: [
        "优先补齐土地出让金与劣后实缴的时序，满足监管与资金闭合要求。",
        "对「评审中」配资准备替代条款，避免单一依赖单一机构批复。",
        "征拆与容积率批复建议锁定里程碑，降低估值敏感性。",
      ],
    },
  },

  "cross-trade": {
    coreRows: [
      ["华北能源", "5,000 万（授信）", "已执行", "原油信用证、单证相符"],
      ["南美贸易联合体", "2.2 亿", "在途", "大豆 FOB、装港检验"],
      ["新加坡 SPV", "区间保密", "理论", "背靠背、对冲安排草案"],
    ],
    secondaryRows: [
      ["卖方主体甲", "区间折算", "已装船/在途", "大宗、港口待靠泊"],
      ["买方主体乙", "约亿级", "开证/混合", "信用证条款谈判"],
      ["参与方丙", "区间隐藏", "理论", "转口与仓储"],
    ],
    brokerRows: [
      ["单证与合规", "—", "已覆盖", "—"],
      ["物流与港口", "—", "部分覆盖", "—"],
      ["授信与结算", "—", "在途额度占用", "—"],
      ["交叉违约条款", "—", "待核心确认", "—"],
    ],
    coreWarn:
      "提示：在途货值与授信占用已接近上限，新开证需追加保证金或压缩敞口。",
    secondaryWarn:
      "提示：区间与代号展示不代表最终结算价，以核心级合同与单证为准。",
    brokerWarn:
      "提示：中介级仅见环节与状态摘要，不涉及具体金额与主体身份。",
    chat: {
      credibilityUserLine: "南美贸易联合体 2.2 亿在途货值的可信度如何？",
      credibilityUserLineMid:
        "卖方主体甲的「区间折算」更偏哪一侧？买方主体乙『约亿级』能否再对齐一下量级区间？单证与在途环节的风险怎么定性？",
      midFollowUp: [
        {
          kind: "credibility",
          userLine:
            "卖方主体甲的「区间折算」更偏哪一侧？买方主体乙『约亿级』能否再对齐一下量级区间？单证与在途环节的风险怎么定性？",
          summaryLines: [
            "关于卖方主体甲「区间折算」：Mid 仅见**区间表述**，不判断「偏装船价哪一侧」的精确口径；**不能**在 Mid 中给出单点折算结论。",
            "关于买方主体乙「约亿级」：仅表示**亿元量级带**，不在 Mid 中进一步对齐到具体区间；开证与授信细节仅 Admin/Core。",
            "关于单证与在途风险：结合在途与授信占用，**综合定性为中等偏紧**（敞口与保证金以核心级为准）。",
          ],
        },
        {
          kind: "refusal",
          userLine:
            "传言里提到的那家南美卖方联合体，有没有可能出现在这条链条里？",
          body:
            "您当前为 Mid 权限，无法将市场传言中的具体卖方主体与表中代号（卖方主体甲等）做实名对应，也无法核实是否「同一条贸易链条」；提单主体与背书记录仅 Admin/Core。",
        },
      ],
      credibilityUserLineLow:
        "单证、物流与授信环节在当前视图下，对整体可信度与敞口风险应如何理解？",
      sidebarPreview: "单证与授信占用已汇总，组合路径待压缩敞口…",
      credibilityTitleCore: "南美贸易联合体",
      credibilityTitleSecondary: "买方主体乙",
      rankingPlansCore: [
        {
          rank: 1,
          name: "华北能源 + 南美贸易联合体 + 新加坡 SPV",
          score: 83,
          rec: true,
        },
        { rank: 2, name: "华北能源 + 南美贸易联合体", score: 72, rec: false },
        { rank: 3, name: "南美贸易联合体 + 新加坡 SPV", score: 65, rec: false },
      ],
      rankingPlansSecondary: [
        {
          rank: 1,
          name: "卖方主体甲 + 买方主体乙 + 参与方丙",
          score: 83,
          rec: true,
        },
        { rank: 2, name: "卖方主体甲 + 买方主体乙", score: 72, rec: false },
        { rank: 3, name: "买方主体乙 + 参与方丙", score: 65, rec: false },
      ],
      rankingBullets: [
        "优先压缩在途敞口：追加保证金或协调港口靠泊与检验节奏。",
        "对「理论」背靠背条款准备备用结算路径，避免交叉违约连锁。",
        "新开证前复核授信占用与单证一致性，控制合规风险。",
      ],
    },
  },

  "digital-portal": {
    coreRows: [
      ["家族科技组", "1,200 万", "已确认", "统一身份、SSO、审计日志"],
      ["云服务商 A", "年费约 180 万", "已签约", "私有部署、等保测评中"],
      ["数据治理顾问", "—", "意向", "主数据、血缘与脱敏策略"],
    ],
    secondaryRows: [
      ["实施方甲", "区间报价", "已确认/混合", "集成范围、接口清单"],
      ["云资源乙", "约百万级/年", "谈判中", "灾备与可用区"],
      ["顾问丙", "按人天", "理论", "治理路线图"],
    ],
    brokerRows: [
      ["身份与权限", "—", "已覆盖", "—"],
      ["报表与待办", "—", "部分上线", "—"],
      ["审计与留痕", "—", "建设中", "—"],
      ["里程碑", "—", "未达阶段验收", "—"],
    ],
    coreWarn:
      "提示：等保测评与家族数据分级策略尚未闭环，上线前需完成安全评审。",
    secondaryWarn:
      "提示：二级用户可见模块范围与脱敏字段以权限矩阵为准。",
    brokerWarn:
      "提示：中介级仅见里程碑与模块状态，不含家族标识与具体金额。",
    chat: {
      credibilityUserLine: "云服务商 A 的私有部署年费可信度如何？",
      credibilityUserLineMid:
        "实施方甲的区间报价，更偏上限还是下限？云资源乙『约百万级/年』能否再理解成偏两百万还是三四百万那一档？等保与里程碑风险怎么理解？",
      midFollowUp: [
        {
          kind: "credibility",
          userLine:
            "实施方甲的区间报价，更偏上限还是下限？云资源乙『约百万级/年』能否再理解成偏两百万还是三四百万那一档？等保与里程碑风险怎么理解？",
          summaryLines: [
            "关于实施方甲区间报价：Mid **不**回答「更偏上限还是下限」的精确位置，仅可理解为**报价区间带**内谈判。",
            "关于云资源乙「约百万级/年」：表示**年费量级在百万级**，不在 Mid 中收窄到「两百万还是三四百万」；合同与折扣仅 Admin/Core。",
            "关于等保与里程碑：在未闭环测评前，**综合风险定性为中等**；与下方报告一致（数值隐藏）。",
          ],
        },
        {
          kind: "refusal",
          userLine:
            "外面说的那家头部云，有没有可能对应云资源乙？",
          body:
            "您当前为 Mid 权限，无法将市场传言中的厂商品牌与表中代号（实施方甲、云资源乙）做实名核实或一一对应；供应商身份与合同主体仅 Admin/Core。",
        },
      ],
      credibilityUserLineLow:
        "身份、审计与等保相关环节，对系统上线可信度结论有什么影响？",
      sidebarPreview: "门户里程碑与安全评审待闭环…",
      credibilityTitleCore: "云服务商 A",
      credibilityTitleSecondary: "云资源乙",
      rankingPlansCore: [
        {
          rank: 1,
          name: "家族科技组 + 云服务商 A + 数据治理顾问",
          score: 81,
          rec: true,
        },
        { rank: 2, name: "家族科技组 + 云服务商 A", score: 70, rec: false },
        { rank: 3, name: "云服务商 A + 数据治理顾问", score: 63, rec: false },
      ],
      rankingPlansSecondary: [
        { rank: 1, name: "实施方甲 + 云资源乙 + 顾问丙", score: 81, rec: true },
        { rank: 2, name: "实施方甲 + 云资源乙", score: 70, rec: false },
        { rank: 3, name: "云资源乙 + 顾问丙", score: 63, rec: false },
      ],
      rankingBullets: [
        "优先闭环等保测评与数据分级策略，再扩大接口与报表范围。",
        "对「意向」顾问锁定人天上限与交付物清单，避免范围蔓延。",
        "灾备与可用区建议与家族 RTO/RPO 指标一次性对齐。",
      ],
    },
  },

  "ip-invest": {
    coreRows: [
      ["片方 A", "出资 4,000 万", "已确认", "剧集独家、分账 45%"],
      ["平台 B", "保底 + 分成", "意向", "独播窗口、对赌条款"],
      ["财务投资人 C", "1,200 万", "理论", "跟投、回购条件谈判"],
    ],
    secondaryRows: [
      ["版权方甲", "区间/分成", "已确认/混合", "授权区域与期限"],
      ["平台乙", "结构保密", "意向为主", "排他窗口"],
      ["跟投方丙", "区间隐藏", "理论", "对赌与回购"],
    ],
    brokerRows: [
      ["授权与分账", "—", "已覆盖", "—"],
      ["对赌与回购", "—", "谈判中", "—"],
      ["宣发与排期", "—", "部分锁定", "—"],
      ["资金闭合", "—", "未达开机门槛", "—"],
    ],
    coreWarn:
      "提示：对赌触发条件与回购义务仍在法审，未闭合前不建议扩大宣发投入。",
    secondaryWarn:
      "提示：分账比例与对价为敏感条款，二级为区间与代号呈现。",
    brokerWarn:
      "提示：中介级仅见项目阶段与环节，不含具体对价与主体名称。",
    chat: {
      credibilityUserLine: "平台 B 的保底 + 分成意向可信度如何？",
      credibilityUserLineMid:
        "版权方甲的区间/分成，更偏保底侧还是分成侧？平台乙『结构保密、意向为主』这条，风险等级大致怎么理解？",
      midFollowUp: [
        {
          kind: "credibility",
          userLine:
            "版权方甲的区间/分成，更偏保底侧还是分成侧？平台乙『结构保密、意向为主』这条，风险等级大致怎么理解？",
          summaryLines: [
            "关于版权方甲「区间/分成」：Mid 仅见**结构类型**，**不能**在 Mid 中判定「更偏保底还是分成」的精确比例；以核心法审与合同为准。",
            "关于平台乙「结构保密、意向为主」：可理解为**对价与条款尚未定稿**，独播与对赌仍在谈判；不宜在 Mid 中展开为具体平台名。",
            "关于风险等级：法审未闭合前，**综合定性为中等**；具体分值见下方隐藏字段。",
          ],
        },
        {
          kind: "refusal",
          userLine:
            "市场传言里提到的某家视频平台，有没有可能对应平台乙？",
          body:
            "您当前为 Mid 权限，无法核实传言中的平台品牌与代号「平台乙」是否为同一主体；独播、对赌与分账细节仅 Admin/Core。",
        },
      ],
      credibilityUserLineLow:
        "授权、对赌与宣发环节，在可信度上能否给出概括性结论（不涉及具体对价）？",
      sidebarPreview: "开机资金与对赌法审进度已同步至组合排名…",
      credibilityTitleCore: "平台 B",
      credibilityTitleSecondary: "平台乙",
      rankingPlansCore: [
        { rank: 1, name: "片方 A + 平台 B + 财务投资人 C", score: 82, rec: true },
        { rank: 2, name: "片方 A + 平台 B", score: 71, rec: false },
        { rank: 3, name: "平台 B + 财务投资人 C", score: 64, rec: false },
      ],
      rankingPlansSecondary: [
        { rank: 1, name: "版权方甲 + 平台乙 + 跟投方丙", score: 82, rec: true },
        { rank: 2, name: "版权方甲 + 平台乙", score: 71, rec: false },
        { rank: 3, name: "平台乙 + 跟投方丙", score: 64, rec: false },
      ],
      rankingBullets: [
        "法审闭合前控制宣发与预付，避免对赌触发后被动加码。",
        "对「理论」跟投准备回购与担保的备选结构。",
        "独播窗口与分账条款建议锁定关键节点与违约救济。",
      ],
    },
  },

  "hk-us-equity": {
    coreRows: [
      ["港股科技组合", "约 1.2 亿市值", "已持仓", "前五标的、行业分散"],
      ["美股成长仓", "约 6,500 万", "已持仓", "期权对冲已启用"],
      ["现金与货基", "约 2,000 万", "已确认", "流动性与追加保证金"],
    ],
    secondaryRows: [
      ["组合甲", "区间净值", "已持仓", "行业与集中度脱敏"],
      ["组合乙", "区间", "已持仓", "对冲比例"],
      ["流动性", "区间", "已确认", "申赎窗口"],
    ],
    brokerRows: [
      ["合规披露", "—", "已满足", "—"],
      ["集中度与杠杆", "—", "在阈值内", "—"],
      ["汇率与对冲", "—", "已覆盖", "—"],
      ["专户条款", "—", "仅限核心", "—"],
    ],
    coreWarn:
      "提示：近期波动率上升，保证金与回撤阈值已触发一次预警，需复核风险预算。",
    secondaryWarn:
      "提示：持仓明细与策略仅核心级可见；二级为区间与分类汇总。",
    brokerWarn:
      "提示：中介级不可见持仓与策略细节，请联系核心投资顾问。",
    chat: {
      credibilityUserLine: "美股成长仓约 6,500 万持仓的对冲安排可信度如何？",
      credibilityUserLineMid:
        "组合甲的区间净值，更偏上沿还是下沿？组合乙的对冲比例这条，波动会更敏感还是更钝化？流动性一行能否再理解成偏高一档还是低一档？",
      midFollowUp: [
        {
          kind: "text",
          userLine:
            "组合甲的区间净值，更偏上沿还是下沿？组合乙的对冲比例这条，波动会更敏感还是更钝化？流动性一行能否再理解成偏高一档还是低一档？",
          title: "追问要点 · 定性说明",
          body:
            "关于组合甲「区间净值」：Mid 仅见区间汇总，不能回答「更偏上沿还是下沿」的单点位置；具体净值与情景以专户与核心模型为准。\n\n关于组合乙「对冲比例」：在 Mid 中不展开为「更敏感还是更钝化」的策略结论；对冲是否充分仅 Admin/Core 结合持仓明细判断。\n\n关于「流动性」一行：可理解为现金与货基等缓冲在区间带内，不能在 Mid 中再细分为「偏高一档还是低一档」；申赎窗口与保证金路径以专户条款为准。\n\n综合风险：在波动率预警已触发的背景下，整体仍定性为中等偏紧（具体评分对 Mid 隐藏）。",
        },
        {
          kind: "refusal",
          userLine:
            "传言里提到的那几只重仓标的，能不能确认分别在组合甲还是组合乙里？",
          body:
            "您当前为 Mid 权限，无法核实具体证券标的、权重及在各组合中的配置；持仓明细与策略仅 Admin/Core。",
        },
      ],
      credibilityUserLineLow:
        "合规披露、集中度与对冲环节，对组合风险与可信度预警应如何理解？",
      sidebarPreview: "波动率预警与保证金测算已带入组合评分…",
      credibilityTitleCore: "美股成长仓",
      credibilityTitleSecondary: "组合乙",
      rankingPlansCore: [
        {
          rank: 1,
          name: "港股科技组合 + 美股成长仓 + 现金与货基",
          score: 85,
          rec: true,
        },
        { rank: 2, name: "港股科技组合 + 美股成长仓", score: 74, rec: false },
        { rank: 3, name: "美股成长仓 + 现金与货基", score: 67, rec: false },
      ],
      rankingPlansSecondary: [
        { rank: 1, name: "组合甲 + 组合乙 + 流动性", score: 85, rec: true },
        { rank: 2, name: "组合甲 + 组合乙", score: 74, rec: false },
        { rank: 3, name: "组合乙 + 流动性", score: 67, rec: false },
      ],
      rankingBullets: [
        "复核风险预算与回撤阈值，必要时下调杠杆或提高现金缓冲。",
        "汇率与对冲比例按情景压力测试再确认，避免单一假设。",
        "申赎窗口与保证金追加路径建议写入专户操作备忘。",
      ],
    },
  },

  "energy-ma": {
    coreRows: [
      ["标的电站 A", "估值约 8 亿", "尽调中", "并网容量、补贴目录"],
      ["产业方 B", "意向 2 亿", "条款谈判", "对赌与业绩承诺"],
      ["储备土地包", "—", "理论", "尽调排期 Q3"],
    ],
    secondaryRows: [
      ["标的甲", "区间估值", "尽调中", "区域与装机"],
      ["产业方乙", "区间", "意向", "对赌区间"],
      ["资产包丙", "隐藏", "理论", "环保与合规"],
    ],
    brokerRows: [
      ["尽调进度", "—", "推进中", "—"],
      ["并网与补贴", "—", "部分满足", "—"],
      ["对赌与交割", "—", "谈判中", "—"],
      ["资金安排", "—", "未达交割条件", "—"],
    ],
    coreWarn:
      "提示：补贴退坡假设下 IRR 敏感，需更新电价与运维成本情景后再定报价。",
    secondaryWarn:
      "提示：标的名称与估值区间为脱敏呈现，以核心级模型为准。",
    brokerWarn:
      "提示：中介级仅见阶段与风险标签，不含标的身份与金额。",
    chat: {
      credibilityUserLine: "产业方 B 意向 2 亿的对赌条款可信度如何？",
      credibilityUserLineMid:
        "标的甲的区间估值，更偏情景下限还是上限？产业方乙的『区间、意向』能否再收窄一点定性？并网与对赌环节的风险怎么理解？",
      midFollowUp: [
        {
          kind: "credibility",
          userLine:
            "标的甲的区间估值，更偏情景下限还是上限？产业方乙的『区间、意向』能否再收窄一点定性？并网与对赌环节的风险怎么理解？",
          summaryLines: [
            "关于标的甲区间估值：Mid **不**回答「更偏下限还是上限」；仅可理解为**多情景估值带**，具体电价与补贴假设以核心模型为准。",
            "关于产业方乙「区间、意向」：**不能**在 Mid 中再收窄为更细的定性；可理解为条款与对赌仍在谈判，未闭合。",
            "关于并网与对赌：并网窗口与业绩承诺存在执行不确定性，**综合风险定性为中等**；与下方报告一致（数值隐藏）。",
          ],
        },
        {
          kind: "refusal",
          userLine:
            "传言里提到的那家产业方，有没有可能对应产业方乙？",
          body:
            "您当前为 Mid 权限，无法将市场传言中的企业与代号「产业方乙」做实名核实；标的身份、对赌口径与尽调底稿仅 Admin/Core。",
        },
      ],
      credibilityUserLineLow:
        "尽调、并网与交割先决条件，对整体可信度结论有什么影响？",
      sidebarPreview: "尽调与补贴情景表已更新，交割条件待对齐…",
      credibilityTitleCore: "产业方 B",
      credibilityTitleSecondary: "产业方乙",
      rankingPlansCore: [
        {
          rank: 1,
          name: "标的电站 A + 产业方 B + 储备土地包",
          score: 80,
          rec: true,
        },
        { rank: 2, name: "标的电站 A + 产业方 B", score: 69, rec: false },
        { rank: 3, name: "产业方 B + 储备土地包", score: 62, rec: false },
      ],
      rankingPlansSecondary: [
        { rank: 1, name: "标的甲 + 产业方乙 + 资产包丙", score: 80, rec: true },
        { rank: 2, name: "标的甲 + 产业方乙", score: 69, rec: false },
        { rank: 3, name: "产业方乙 + 资产包丙", score: 62, rec: false },
      ],
      rankingBullets: [
        "补贴退坡与电价情景更新后再定报价区间，避免 IRR 误判。",
        "并网与环保合规建议作为交割先决条件写清。",
        "对「理论」土地包单独排期尽调，避免拖累主交易时间表。",
      ],
    },
  },

  "med-channel": {
    coreRows: [
      ["华东经销联合体", "3,000 万", "已确认", "三类证、进院 42 家"],
      ["厂商直营", "1,500 万", "意向", "集采谈判、返点结构"],
      ["区域代理 D", "800 万", "理论", "县域覆盖、冷链共建"],
    ],
    secondaryRows: [
      ["经销甲", "区间", "已确认/混合", "进院家数区间"],
      ["厂商乙", "区间", "意向", "集采条款"],
      ["代理丙", "隐藏", "理论", "县域"],
    ],
    brokerRows: [
      ["进院与准入", "—", "已覆盖", "—"],
      ["集采与价格", "—", "谈判中", "—"],
      ["冷链与物流", "—", "部分覆盖", "—"],
      ["回款与账期", "—", "未达目标", "—"],
    ],
    coreWarn:
      "提示：集采降价压力上升，需重新测算渠道毛利与回款周期。",
    secondaryWarn:
      "提示：医院名单与价格为敏感信息，二级为区间与代号。",
    brokerWarn:
      "提示：中介级仅见覆盖家数区间与环节状态。",
    chat: {
      credibilityUserLine: "厂商直营 1,500 万集采意向的可信度如何？",
      credibilityUserLineMid:
        "经销甲的进院家数区间，更偏保守端还是乐观端？厂商乙『意向、集采条款』这条，从可信度上怎么理解？",
      midFollowUp: [
        {
          kind: "credibility",
          userLine:
            "经销甲的进院家数区间，更偏保守端还是乐观端？厂商乙『意向、集采条款』这条，从可信度上怎么理解？",
          summaryLines: [
            "关于经销甲进院家数区间：Mid **不**判断「更偏保守还是乐观」；仅可理解为**已覆盖家数落在区间带内**，医院名单与精确家数仅 Admin/Core。",
            "关于厂商乙「意向、集采条款」：可理解为**商务与价格条款尚未定稿**，可信度随集采落地与回款条件而变；不宜在 Mid 中收窄为具体厂商实名。",
            "综合风险：在集采降价与账期压力下，**整体定性为中等**；与下方报告一致（数值隐藏）。",
          ],
        },
        {
          kind: "refusal",
          userLine:
            "外面说的某国产龙头有没有可能对应厂商乙？",
          body:
            "您当前为 Mid 权限，无法将市场传言中的厂商品牌与代号「厂商乙」做实名核实；商务身份与集采对价仅 Admin/Core。",
        },
      ],
      credibilityUserLineLow:
        "进院、集采与回款环节，在当前权限下能否概括可信度与账期风险？",
      sidebarPreview: "进院与集采条款已纳入组合评分与回款测算…",
      credibilityTitleCore: "厂商直营",
      credibilityTitleSecondary: "厂商乙",
      rankingPlansCore: [
        {
          rank: 1,
          name: "华东经销联合体 + 厂商直营 + 区域代理 D",
          score: 81,
          rec: true,
        },
        { rank: 2, name: "华东经销联合体 + 厂商直营", score: 70, rec: false },
        { rank: 3, name: "厂商直营 + 区域代理 D", score: 63, rec: false },
      ],
      rankingPlansSecondary: [
        { rank: 1, name: "经销甲 + 厂商乙 + 代理丙", score: 81, rec: true },
        { rank: 2, name: "经销甲 + 厂商乙", score: 70, rec: false },
        { rank: 3, name: "厂商乙 + 代理丙", score: 63, rec: false },
      ],
      rankingBullets: [
        "集采降价情景下重算渠道毛利与回款周期，再定商务政策。",
        "进院家数与县域覆盖建议锁定主经销商，降低协调成本。",
        "冷链共建与账期条款纳入统一合同框架，避免碎片化承诺。",
      ],
    },
  },

  "offshore-trust": {
    coreRows: [
      ["BVI 控股 SPV", "—", "结构已定", "持股路径、反避税条款"],
      ["受益人安排", "—", "评审中", "类别与分配触发"],
      ["税务顾问团队", "—", "意向", "CRS、经济实质申报"],
    ],
    secondaryRows: [
      ["架构层甲", "—", "已定/混合", "脱敏路径"],
      ["受益层级", "—", "评审", "分配规则"],
      ["顾问乙", "—", "理论", "合规申报"],
    ],
    brokerRows: [
      ["架构完整性", "—", "已满足", "—"],
      ["合规申报", "—", "推进中", "—"],
      ["经济实质", "—", "待补充", "—"],
      ["披露范围", "—", "仅限核心", "—"],
    ],
    coreWarn:
      "提示：受益人变更与分配触发条件涉及跨境申报，法审完成前勿对外承诺。",
    secondaryWarn:
      "提示：受益人细节仅核心级；二级为结构层级与状态。",
    brokerWarn:
      "提示：离岸架构与税务路径不对中介级展示。",
    chat: {
      credibilityUserLine: "受益人安排评审材料的可信度如何？",
      credibilityUserLineMid:
        "架构层甲与受益层级两行，评审进度能不能再对齐一下？风险等级大致怎么理解？",
      midFollowUp: [
        {
          kind: "credibility",
          userLine:
            "架构层甲与受益层级两行，评审进度能不能再对齐一下？风险等级大致怎么理解？",
          summaryLines: [
            "关于「评审进度」：Mid 仅见**已定/评审中**等状态标签，不能在对话里把两行进度「对齐到同一日历节点」；具体时间表与法审结论仅 Admin/Core。",
            "关于架构层甲与受益层级：可理解为**披露范围按权限截断**，路径细节不对 Mid 展开。",
            "关于风险等级：在 CRS/经济实质申报未全部闭合前，**综合定性为中等**；与下方报告一致（数值隐藏）。",
          ],
        },
        {
          kind: "refusal",
          userLine:
            "传言里提到的某离岸 SPV，有没有可能落在架构层甲这条路径里？",
          body:
            "您当前为 Mid 权限，无法核实或推断具体离岸主体、持股路径与 SPV 的对应关系；涉及受益人身份、离岸架构精确路径及市场传言的指认，仅对 Admin/Core 在合规流程内开放。如需核实，请通过核心对接人发起正式申请。",
        },
      ],
      credibilityUserLineLow:
        "架构完整性与合规申报环节，对整体可信度能否给出定性结论？",
      sidebarPreview: "架构与 CRS 申报节点已同步，披露范围按权限截断…",
      credibilityTitleCore: "受益人安排",
      credibilityTitleSecondary: "受益层级",
      rankingPlansCore: [
        {
          rank: 1,
          name: "BVI 控股 SPV + 受益人安排 + 税务顾问团队",
          score: 79,
          rec: true,
        },
        { rank: 2, name: "BVI 控股 SPV + 受益人安排", score: 68, rec: false },
        { rank: 3, name: "受益人安排 + 税务顾问团队", score: 61, rec: false },
      ],
      rankingPlansSecondary: [
        { rank: 1, name: "架构层甲 + 受益层级 + 顾问乙", score: 79, rec: true },
        { rank: 2, name: "架构层甲 + 受益层级", score: 68, rec: false },
        { rank: 3, name: "受益层级 + 顾问乙", score: 61, rec: false },
      ],
      rankingBullets: [
        "法审闭合前避免对外承诺分配触发与变更路径。",
        "经济实质与 CRS 申报材料建议一次性打包评审。",
        "反避税条款与持股路径变更纳入同一披露清单。",
      ],
    },
  },

  "edu-ma": {
    coreRows: [
      ["职教集团 E", "估值约 3.5 亿", "尽调中", "校区 12 所、在读人数"],
      ["产业并购基金", "意向 1.5 亿", "条款谈判", "对赌与业绩承诺"],
      ["地方国资", "8,000 万", "理论", "混改路径与牌照"],
    ],
    secondaryRows: [
      ["标的甲", "区间估值", "尽调中", "校区网络"],
      ["基金乙", "区间", "意向", "对赌区间"],
      ["国资丙", "隐藏", "理论", "混改"],
    ],
    brokerRows: [
      ["牌照与办学", "—", "已覆盖", "—"],
      ["校区与在读", "—", "部分核实", "—"],
      ["对赌与交割", "—", "谈判中", "—"],
      ["资金安排", "—", "未达签约条件", "—"],
    ],
    coreWarn:
      "提示：招生人数与学费假设对估值敏感，需更新尽调底稿后再报价。",
    secondaryWarn:
      "提示：校区与城市为脱敏呈现，具体以核心级数据为准。",
    brokerWarn:
      "提示：中介级仅见阶段与风险摘要。",
    chat: {
      credibilityUserLine: "产业并购基金意向 1.5 亿的对赌可信度如何？",
      credibilityUserLineMid:
        "标的甲的区间估值，更靠近区间下端还是上端？基金乙的『区间、意向』这条，对赌与交割风险怎么定性？",
      midFollowUp: [
        {
          kind: "credibility",
          userLine:
            "标的甲的区间估值，更靠近区间下端还是上端？基金乙的『区间、意向』这条，对赌与交割风险怎么定性？",
          summaryLines: [
            "关于标的甲区间估值：Mid **不**回答「更靠下端还是上端」；仅可理解为**尽调中的估值区间带**，招生与学费假设以核心底稿为准。",
            "关于基金乙「区间、意向」：**不能**在 Mid 中进一步收窄定性；可理解为出资条款与对赌仍在谈判。",
            "关于对赌与交割：在牌照与混改路径未完全闭合前，**综合风险定性为中等**；与下方报告一致（数值隐藏）。",
          ],
        },
        {
          kind: "refusal",
          userLine:
            "市场传言里提到的国资背景基金有没有可能对应基金乙？",
          body:
            "您当前为 Mid 权限，无法核实传言中的基金主体与代号「基金乙」是否为同一出资方；国资路径与交易文件仅 Admin/Core。",
        },
      ],
      credibilityUserLineLow:
        "尽调、对赌与交割里程碑，对整体可信度结论应如何理解？",
      sidebarPreview: "校区与在读核实已带入估值敏感性表…",
      credibilityTitleCore: "产业并购基金",
      credibilityTitleSecondary: "基金乙",
      rankingPlansCore: [
        {
          rank: 1,
          name: "职教集团 E + 产业并购基金 + 地方国资",
          score: 82,
          rec: true,
        },
        { rank: 2, name: "职教集团 E + 产业并购基金", score: 71, rec: false },
        { rank: 3, name: "产业并购基金 + 地方国资", score: 64, rec: false },
      ],
      rankingPlansSecondary: [
        { rank: 1, name: "标的甲 + 基金乙 + 国资丙", score: 82, rec: true },
        { rank: 2, name: "标的甲 + 基金乙", score: 71, rec: false },
        { rank: 3, name: "基金乙 + 国资丙", score: 64, rec: false },
      ],
      rankingBullets: [
        "招生与学费假设更新后再报价，避免尽调底稿与模型脱节。",
        "牌照与混改路径建议作为签约先决条件明确列示。",
        "对赌与交割里程碑与资金到位节奏一次性对齐。",
      ],
    },
  },
};

export function getProjectResourceDemo(projectId: string): ProjectResourceDemo {
  return DEMOS[projectId] ?? DEMOS.shrimp;
}

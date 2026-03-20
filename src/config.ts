export const SITE = {
  website: "https://besthope-blog.pages.dev/", // replace this with your deployed domain
  author: "Besthope",
  profile: "",
  desc: "Besthope 的个人博客",
  title: "Besthope's Blog",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "编辑此页",
    url: "",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "zh-CN", // html lang code. Set this empty and default will be "zh-CN"
  timezone: "Asia/Shanghai", // Default global timezone (IANA format)
} as const;

export const GISCUS = {
  enabled: true,
  repo: "Besthope-Official/blog",
  repoId: "R_kgDORridWQ",
  category: "Announcements",
  categoryId: "DIC_kwDORridWc4C41Bw",
  mapping: "pathname",
  strict: "0",
  reactionsEnabled: "1",
  emitMetadata: "0",
  inputPosition: "bottom",
  lang: "zh-CN",
  lightTheme: "light",
  darkTheme: "dark",
} as const;

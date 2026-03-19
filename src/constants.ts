import type { Props } from "astro";
import IconMail from "@/assets/icons/IconMail.svg";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
import IconTencentQQ from "@/assets/icons/IconTencentQQ.svg";
import IconTencentQzone from "@/assets/icons/IconTencentQzone.svg";

interface Social {
  name: string;
  href: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
}

export const SOCIALS: Social[] = [];

export const SHARE_LINKS: Social[] = [
  {
    name: "QQ",
    href: "https://connect.qq.com/widget/shareqq/index.html?url=",
    linkTitle: "分享到 QQ",
    icon: IconTencentQQ,
  },
  {
    name: "QZone",
    href: "https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=",
    linkTitle: "分享到 QQ 空间",
    icon: IconTencentQzone,
  },
  {
    name: "X",
    href: "https://x.com/intent/post?url=",
    linkTitle: "分享到 X",
    icon: IconBrandX,
  },
  {
    name: "Mail",
    href: "mailto:?subject=%E7%9C%8B%E7%9C%8B%E8%BF%99%E7%AF%87%E6%96%87%E7%AB%A0&body=",
    linkTitle: "通过邮件分享这篇文章",
    icon: IconMail,
  },
] as const;

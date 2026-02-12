import type { Metadata, Site, Socials } from "@types";

export const SITE: Site = {
  TITLE: "Nth bit",
  DESCRIPTION: "Personal blog with a focus just a meat-and-potatoes approach.",
  EMAIL: "sobczak.maciej.ms@gmail.com",
  NUM_POSTS_ON_HOMEPAGE: 5,
  NUM_PROJECTS_ON_HOMEPAGE: 0,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Personal blog with a focus just a meat-and-potatoes approach.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "A collection of articles on topics bothers me lately.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION:
    "A collection of my projects with links to repositories and live demos.",
};

export const SOCIALS: Socials = [
  {
    NAME: "GitHub",
    HREF: "https://github.com/kmvg",
  },
];

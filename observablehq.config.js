import {generateHeader} from "@one-data/observable-themes/header";
import {generateFooter} from "@one-data/observable-themes/footer";
import {icon} from "@one-data/observable-themes/use-images";

export default {

  title: "Trade Explorer",
  head: `<link rel="icon" href=${icon} type="image/png" sizes="32x32">`,

  header: generateHeader({title: "Trade Explorer"}),
  footer: generateFooter(),

  root: "src",
  style: "style.css",

  toc: false,
  sidebar: false,
  pager: false,
};

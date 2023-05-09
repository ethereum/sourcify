import Fuse from "fuse.js";
import { SelectSearchOption } from "react-select-search";

export function fuzzySearch(options: SelectSearchOption[]) {
  const fuse = new Fuse(options, {
    keys: ["name", "groupName", "items.name"],
    threshold: 0.6,
  });
  return (value: string) => {
    if (!value.length) {
      return options;
    }
    return fuse
      .search(value)
      .map((res: Fuse.FuseResult<SelectSearchOption>) => res.item);
  };
}

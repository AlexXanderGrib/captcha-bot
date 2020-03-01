import { readFile } from "fs";
import { promisify } from "util";
import { parse } from "yaml";
import { join } from "path";

const configPath = join(__dirname, "..", "config");

export type AllowArray<T> = T | T[];
export type SimpleType = string | number | boolean;
export type SimpleObject = { [key: string]: AllowArray<SimpleType> };

export type Config = {
  [key: string]: AllowArray<SimpleType | Config>;
};

export default async (configFileName: string): Promise<Config> => {
  const data = await promisify(readFile)(
    join(configPath, `${configFileName}.yml`),
    {
      encoding: "utf8"
    }
  );

  return parse(data) as Config;
};

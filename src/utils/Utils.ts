import fs from 'fs';
import path from 'path';
import config from '../config';

import { outputFileSync } from 'fs-extra';
const saveFile = outputFileSync;

/**
 * Save file and update the repository tag
 *
 * @param path
 * @param file
 */
export function save(path: string, file: any) {
  saveFile(path, file);
  updateRepositoryTag();
}

type Tag = {
  timestamp: any,
  repositoryVersion: string
}

/**
 * Update repository tag
 */
export function updateRepositoryTag(repositoryPath?: string) {
  if (repositoryPath !== undefined) {
    config.repository.path = repositoryPath;
  }
  const filePath: string = path.join(config.repository.path, 'manifest.json')
  const timestamp = new Date().getTime();
  const repositoryVersion = process.env.REPOSITORY_VERSION || '0.1';
  const tag: Tag = {
    timestamp: timestamp,
    repositoryVersion: repositoryVersion
  }
  fs.writeFileSync(filePath, JSON.stringify(tag));
}

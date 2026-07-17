import { promises as fs } from "fs";
import path from "path";
import type { SessionVideoData } from "@/lib/clublab/types";
import { logger } from '@/lib/logger';

const DATA_FILE_PATH = path.join(process.cwd(), "src", "data", "match-video-analysis.json");

async function ensureDataFileExists(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(DATA_FILE_PATH), { recursive: true });
    try {
      await fs.access(DATA_FILE_PATH);
    } catch {
      await fs.writeFile(DATA_FILE_PATH, JSON.stringify({}, null, 2), "utf8");
    }
  } catch (error) {
    console.error("Error ensuring video analysis file exists:", error);
  }
}

export async function getVideoAnalysis(matchId: string): Promise<SessionVideoData> {
  await ensureDataFileExists();
  try {
    const content = await fs.readFile(DATA_FILE_PATH, "utf8");
    const data = JSON.parse(content);
    return data[matchId] || { general_notes: "", videos: [], montages: [] };
  } catch (error) {
    console.error(`Error reading video analysis for match ${matchId}:`, error);
    return { general_notes: "", videos: [], montages: [] };
  }
}

export async function saveVideoAnalysis(matchId: string, videoData: SessionVideoData): Promise<void> {
  await ensureDataFileExists();
  try {
    const content = await fs.readFile(DATA_FILE_PATH, "utf8");
    const data = JSON.parse(content);
    data[matchId] = videoData;
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error(`Error writing video analysis for match ${matchId}:`, error);
    throw error;
  }
}

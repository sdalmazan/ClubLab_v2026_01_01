import { AnalysisDataProvider } from "../providers/core";
import { SavedView } from "../types";

/**
 * SavedViewsClient — Client wrapper for saved search views.
 * Interacts with AnalysisDataProvider to fetch, insert, update, or delete configurations.
 */
export class SavedViewsClient {
  /**
   * List all saved views for a specific organization, ordered by favorites first.
   */
  static async getViews(organizationId: string): Promise<SavedView[]> {
    return await AnalysisDataProvider.getSavedViews(organizationId);
  }

  /**
   * Save (insert or update) a custom search view.
   */
  static async saveView(view: SavedView): Promise<any> {
    return await AnalysisDataProvider.saveView(view);
  }

  /**
   * Delete a custom search view by ID.
   */
  static async deleteView(viewId: string): Promise<boolean> {
    return await AnalysisDataProvider.deleteView(viewId);
  }
}

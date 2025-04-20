import { SectionType } from "../state/modules/constants.js";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { Logger } from "../lib/logger.js";

// Get the directory name for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for managing dependencies between proposal sections
 * Uses a configuration file to determine which sections depend on others
 */
export class DependencyService {
  private dependencyMap: Map<SectionType, SectionType[]>;
  private logger: Logger;

  /**
   * Create a new DependencyService instance
   * @param dependencyMapPath Optional custom path to the dependency map JSON file
   */
  constructor(dependencyMapPath?: string) {
    this.dependencyMap = new Map();
    this.logger = Logger.getInstance();
    this.loadDependencyMap(dependencyMapPath);
  }

  /**
   * Load the dependency map from a JSON file
   * @param dependencyMapPath Optional path to the JSON file
   */
  private async loadDependencyMap(dependencyMapPath?: string): Promise<void> {
    const mapPath =
      dependencyMapPath ||
      path.resolve(__dirname, "../config/dependencies.json");

    try {
      const data = await fs.readFile(mapPath, "utf8");
      const mapData = JSON.parse(data);

      Object.entries(mapData).forEach(([section, deps]) => {
        this.dependencyMap.set(
          section as SectionType,
          (deps as string[]).map((dep) => dep as SectionType)
        );
      });

      this.logger.info("Dependency map loaded successfully");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to load dependency map: ${errorMessage}`);
      throw new Error(`Failed to load dependency map: ${errorMessage}`);
    }
  }

  /**
   * Get sections that depend on the given section
   * @param sectionId The section to find dependents for
   * @returns Array of section identifiers that depend on the given section
   */
  getDependentsOf(sectionId: SectionType): SectionType[] {
    const dependents: SectionType[] = [];

    this.dependencyMap.forEach((dependencies, section) => {
      if (dependencies.includes(sectionId)) {
        dependents.push(section);
      }
    });

    return dependents;
  }

  /**
   * Get all dependencies for a section
   * @param sectionId The section to find dependencies for
   * @returns Array of section identifiers that the given section depends on
   */
  getDependenciesOf(sectionId: SectionType): SectionType[] {
    return this.dependencyMap.get(sectionId) || [];
  }

  /**
   * Get the full dependency tree for a section (recursively)
   * @param sectionId The section to find all dependents for
   * @returns Array of all sections that directly or indirectly depend on the given section
   */
  getAllDependents(sectionId: SectionType): SectionType[] {
    const directDependents = this.getDependentsOf(sectionId);
    const allDependents = new Set<SectionType>(directDependents);

    directDependents.forEach((dependent) => {
      this.getAllDependents(dependent).forEach((item) =>
        allDependents.add(item)
      );
    });

    return Array.from(allDependents);
  }

  /**
   * Checks if there is a dependency path from one section to another
   * @param fromSection The starting section
   * @param toSection The target section
   * @returns true if toSection depends on fromSection directly or indirectly
   */
  isDependencyOf(fromSection: SectionType, toSection: SectionType): boolean {
    // Direct dependency check
    const directDeps = this.getDependenciesOf(toSection);
    if (directDeps.includes(fromSection)) {
      return true;
    }

    // Recursive check for indirect dependencies
    return directDeps.some((dep) => this.isDependencyOf(fromSection, dep));
  }

  /**
   * Get all sections in dependency order (topological sort)
   * @returns Array of sections sorted so that no section comes before its dependencies
   */
  getSectionsInDependencyOrder(): SectionType[] {
    const visited = new Set<SectionType>();
    const result: SectionType[] = [];

    // Helper function for depth-first traversal
    const visit = (section: SectionType) => {
      if (visited.has(section)) return;
      visited.add(section);

      // Visit dependencies first
      const dependencies = this.getDependenciesOf(section);
      for (const dep of dependencies) {
        visit(dep);
      }

      // Then add the current section
      result.push(section);
    };

    // Visit all sections
    for (const section of this.dependencyMap.keys()) {
      visit(section);
    }

    return result;
  }
}

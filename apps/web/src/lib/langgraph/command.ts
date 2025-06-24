/**
 * Client-safe Command class for LangGraph resume operations
 * 
 * This is a lightweight implementation that matches the LangGraph Command
 * format without importing server-side dependencies.
 */

export class Command {
  public readonly resume: any;
  public readonly update?: any;
  public readonly goto?: string | string[];

  constructor(options: { 
    resume?: any; 
    update?: any;
    goto?: string | string[];
  }) {
    this.resume = options.resume;
    this.update = options.update;
    this.goto = options.goto;
  }

  // Serialize to match LangGraph expected format
  toJSON() {
    const obj: any = {};
    if (this.resume !== undefined) obj.resume = this.resume;
    if (this.update !== undefined) obj.update = this.update;
    if (this.goto !== undefined) obj.goto = this.goto;
    return obj;
  }
}
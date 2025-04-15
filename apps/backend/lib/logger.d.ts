/**
 * Type definitions for logger.js
 */

export declare enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export declare class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private constructor(level?: LogLevel);
  
  public static getInstance(): Logger;
  public setLogLevel(level: LogLevel): void;
  public error(message: string, ...args: any[]): void;
  public warn(message: string, ...args: any[]): void;
  public info(message: string, ...args: any[]): void;
  public debug(message: string, ...args: any[]): void;
  public trace(message: string, ...args: any[]): void;
}
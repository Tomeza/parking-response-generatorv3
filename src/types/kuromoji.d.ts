import 'kuromoji';

declare module 'kuromoji' {
  interface TokenizerBuilderOption {
    userDicPath?: string;
  }
} 
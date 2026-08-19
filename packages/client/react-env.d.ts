declare namespace React {
  type ReactNode = any
  type ReactElement = any
  type CSSProperties = Record<string, any>
  type FC<P = {}> = (props: P & { key?: any; children?: any }) => ReactElement | null
  type ComponentType<P = {}> = FC<P>
  type RefObject<T> = { current: T | null }
  type ChangeEvent<T = Element> = { target: T }
  type FormEvent<T = Element> = { preventDefault: () => void; target: T }
  type KeyboardEvent<T = Element> = { key: string; shiftKey: boolean; preventDefault: () => void; target: T }
  type MouseEvent<T = Element> = { preventDefault: () => void; stopPropagation: () => void; target: T }
  type ButtonHTMLAttributes<T = HTMLButtonElement> = Record<string, any>
  type HTMLAttributes<T = HTMLElement> = Record<string, any>

  interface Context<T> {
    Provider: (props: { value: T; children?: any }) => any
    Consumer: (props: { children: (value: T) => any }) => any
  }

  function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prev: T) => T)) => void]
  function useEffect(effect: () => void | (() => void), deps?: any[]): void
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T
  function useMemo<T>(factory: () => T, deps: any[]): T
  function useRef<T>(initialValue: T | null): RefObject<T>
  function createContext<T>(defaultValue?: T): Context<T>
  function useContext<T>(context: Context<T>): T
  const StrictMode: FC<{ children?: any }>
}

declare module 'react' {
  export type ReactNode = React.ReactNode
  export type ReactElement = React.ReactElement
  export type CSSProperties = React.CSSProperties
  export type FC<P = {}> = React.FC<P>
  export type ComponentType<P = {}> = React.ComponentType<P>
  export type RefObject<T> = React.RefObject<T>
  export type ChangeEvent<T = Element> = React.ChangeEvent<T>
  export type FormEvent<T = Element> = React.FormEvent<T>
  export type KeyboardEvent<T = Element> = React.KeyboardEvent<T>
  export type MouseEvent<T = Element> = React.MouseEvent<T>
  export type ButtonHTMLAttributes<T = HTMLButtonElement> = React.ButtonHTMLAttributes<T>
  export type HTMLAttributes<T = HTMLElement> = React.HTMLAttributes<T>
  export type Context<T> = React.Context<T>

  export const useState: typeof React.useState
  export const useEffect: typeof React.useEffect
  export const useCallback: typeof React.useCallback
  export const useMemo: typeof React.useMemo
  export const useRef: typeof React.useRef
  export const createContext: typeof React.createContext
  export const useContext: typeof React.useContext
  export const StrictMode: typeof React.StrictMode

  export default React
}

declare module 'react/jsx-runtime' {
  export const jsx: any
  export const jsxs: any
  export const Fragment: any
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): {
    render(children: any): void
    unmount(): void
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any
  }
  interface IntrinsicAttributes {
    key?: any
    children?: any
  }
  interface Element extends any {}
}

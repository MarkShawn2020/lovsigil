import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // SSR 和 hydration 时使用 false，确保一致性
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    // 客户端挂载后立即设置正确值
    const checkMobile = () => window.innerWidth < MOBILE_BREAKPOINT
    setIsMobile(checkMobile())

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(checkMobile())
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

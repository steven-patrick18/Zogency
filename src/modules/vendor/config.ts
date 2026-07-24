export function vendorModeEnabled(): boolean {
  return process.env.ZOGENCY_VENDOR_MODE === '1'
}

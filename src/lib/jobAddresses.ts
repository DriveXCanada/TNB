export function jobAddresses(job: { address: string; altAddresses: string | null }) {
  return [job.address, ...(job.altAddresses?.split("\n").map((s) => s.trim()).filter(Boolean) ?? [])];
}

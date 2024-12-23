import axios from 'axios';

const knownChains = [
  "zksync-era",
  "zksync-era-testnet",
  "scroll-testnet",
  "scroll-mainnet",
  "abstract-testnet",
  "zkcandy-testnet",
] as const
export type AllChain = (typeof knownChains)[number]

export async function getSales(
  filters?: Record<string, string>,
  page = 0,
  size = 200,
  sort?: string,
  order?: "ASC" | "DESC",
  chain?: AllChain,
): Promise<any[]> {
  try {
    sort = sort || "blockNumber"
    order = order || "DESC"
    const name = ["ItemBought", "OrderFulfilled"]
    const withNft = "true"
    const url = `${getPublicAPIUrl(chain)}/events?${buildQueryParams({ page, size, name, sort, order, withNft, ...filters })}`
    console.log("getSales", url)

    await new Promise(resolve => setTimeout(resolve, 1000))

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'TelegramSalesBot/1.0'
      }
    })
    return response.data
  }
  catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      console.error('Rate limited, waiting 60 seconds...')
      await new Promise(resolve => setTimeout(resolve, 60000))
      return getSales(filters, page, size, sort, order, chain)
    }
    console.error(`Fetch Error: ${error} `)
    return []
  }
}
export function getPublicAPIUrl(network?: AllChain): string {
  if (process.env.NEXT_PUBLIC_API_URL_OVERRIDE)
    return process.env.NEXT_PUBLIC_API_URL_OVERRIDE + "/" + network

  switch (network) {
    case "zksync-era":
      return "https://api.zkmarkets.com/zksync-era"
    case "zksync-era-testnet":
      return "https://api.testnet.zkmarkets.com/zksync-era-testnet"
    case "scroll-testnet":
      return "https://api.testnet.zkmarkets.com/scroll-testnet"
    case "scroll-mainnet":
      return "https://api.zkmarkets.com/scroll-mainnet"
    case "abstract-testnet":
      return "https://api.testnet.zkmarkets.com/abstract-testnet"
    case "zkcandy-testnet":
      return "https://api.testnet.zkmarkets.com/zkcandy-testnet"
    default:
      return ""
  }
}

function buildQueryParams(params: any) {
  return Object.keys(params)
    .filter(key => params[key] != null)
    .flatMap((key) => {
      const value = params[key]
      if (value === null || value === undefined) {
        return []
      } {
        if (Array.isArray(value)) {
          return value.map(
            arrayValue => `${encodeURIComponent(key)}=${encodeURIComponent(arrayValue)}`,
          )
        }
        else {
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        }
      }
    })
    .join("&")
}

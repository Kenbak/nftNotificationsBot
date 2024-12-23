import { WorkerBase } from "./WorkerBase"
import { AllChain, getSales } from "../functions"
import TelegramBot from "node-telegram-bot-api"
import { FunctionalityConfig } from "../config/FunctionalityConfig"
import axios from 'axios'
import sharp from 'sharp'


const ZKMARKETS_API_URL = 'https://api.zkmarkets.com/zksync-era/collections';

export class TelegramSalesBot extends WorkerBase {
  private bot: TelegramBot
  private lastCheckTime: number

  constructor(
    interval: number,
    private network: AllChain,
    private collectionAddress: string,
    private chatId: string,
    existingBot?: TelegramBot
  ) {
    super(interval, "TelegramSalesBot")
    const config = new FunctionalityConfig()
    this.bot = existingBot || new TelegramBot(config.telegramBotToken, { polling: false })
    this.lastCheckTime = Math.floor(Date.now() / 1000)
  }

  async iteration() {
    const currentTime = Math.floor(Date.now() / 1000)

    const lastSales = await getSales({
      collectionAddress: this.collectionAddress,
      timeFrom: this.lastCheckTime.toString(),
    }, 0, 10, "createdAt", "DESC", this.network)

    // Update check time only after successful fetch
    this.lastCheckTime = currentTime

    if (lastSales.length > 0) {
      this.logger.log(`Found ${lastSales.length} new sales`)
      const collectionData = await this.getCollectionData()

      // Process sales in chronological order
      for (const sale of lastSales.reverse()) {
        await this.sendSaleNotification(sale, collectionData)
      }
    }
  }

  private calculateTotalVolume(sales: any[]): string {
    const totalVolume = sales.reduce((sum, sale) => sum + parseFloat(sale.price) / 1e18, 0);
    return totalVolume.toFixed(4);
  }

  private async getCollectionData() {
    try {
      console.log(`Fetching collection data from: ${ZKMARKETS_API_URL}/${this.collectionAddress}`);
      const response = await axios.get(`${ZKMARKETS_API_URL}/${this.collectionAddress}`);
      console.log('Collection data response:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error('Failed to fetch collection data:', error);
      return null;
    }
  }

  private async sendSaleNotification(sale: any, collectionData: any) {
    console.log('Processing sale:', JSON.stringify(sale, null, 2));

    const saleAmountEth = parseFloat(sale.price) / 1e18;
    const ethPrice = 2548; // You might want to fetch this dynamically
    const saleAmountUsd = saleAmountEth * ethPrice;
    const nftData = sale.nft;

    console.log('Calculated sale amounts:', { saleAmountEth, saleAmountUsd });

    let floorPrice = collectionData?.floorPriceEth;// Default to sale price if collection data is not available
    let totalSupply = 6400; // Use assetCount or default to 6400
    let marketCap = floorPrice * totalSupply * ethPrice;



    console.log('Calculated collection stats:', { floorPrice, totalSupply, marketCap });

    const formatNumber = (num: number | undefined): string => {
      if (num === undefined || isNaN(num)) return 'N/A';
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    const message = `
🎉 *HUE Buy!* 🎉

💰 Spent: *$${formatNumber(saleAmountUsd)}* (${saleAmountEth.toFixed(4)} ETH)
🖼️ Got: *${nftData?.name || 'Unknown'}*
🧑‍🚀 Buyer: \`${sale.to?.slice(0, 6)}...${sale.to?.slice(-4) || 'Unknown'}\`
🔢 Hue #${sale.tokenId || 'N/A'}

📊 Market Cap: *$${formatNumber(marketCap)}*
🏷️ Floor Price: *$${formatNumber(floorPrice * ethPrice)}* (${floorPrice.toFixed(4)} ETH)

[View on Explorer](https://explorer.zksync.io/tx/${sale.transactionHash || 'Unknown'})
`;

    console.log('Sending message:', message);

    // Send message with image if available
    if (nftData?.originalImageUrl) {
      try {
        let imageBuffer: Buffer;
        if (nftData.originalImageUrl.startsWith('data:image/svg+xml;base64,')) {
          imageBuffer = await this.convertSvgToPng(nftData.originalImageUrl);
        } else {
          const response = await fetch(nftData.originalImageUrl);
          imageBuffer = Buffer.from(await response.arrayBuffer());
        }

        console.log('Image processed successfully');

        // Send photo with caption
        await this.bot.sendPhoto(this.chatId, imageBuffer, {
          caption: message,
          parse_mode: 'Markdown'
        });
        console.log('Photo sent successfully');
      } catch (error) {
        console.error('Failed to send image:', error);
        // If image fails, send text message
        await this.sendTextMessage(message);
      }
    } else {
      console.log('No image available, sending text message');
      // If no image, send text message
      await this.sendTextMessage(message);
    }
  }

  private async convertSvgToPng(svgDataUri: string): Promise<Buffer> {
    // Extract the base64 encoded SVG content
    const base64Content = svgDataUri.split(',')[1];
    const svgBuffer = Buffer.from(base64Content, 'base64');

    // Convert SVG to PNG using sharp
    return sharp(svgBuffer)
      .png()
      .resize(1024, 1024, { fit: 'inside' })
      .toBuffer();
  }

  private async sendTextMessage(message: string) {
    await this.bot.sendMessage(this.chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  }
}

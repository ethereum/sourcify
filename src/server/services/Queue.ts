import { Connection, connect, ConfirmChannel } from 'amqplib';
import { Options, Replies } from 'amqplib/properties';

class MessageQueue {

    connection?: Connection;
    connectionOptions: Options.Connect;

    constructor() {
        this.connectionOptions = {
            username: process.env.RABBITMQUSERNAME,
            password: process.env.RABBITMQPASSWORD
        }
    }

    public async createConnection(){
      this.connection = await connect(this.connectionOptions);
    }

    public async createChannelAndExchange(exchange: string, topic: string): Promise<ConfirmChannel>{
      const channel: ConfirmChannel = await this.connection!!.createConfirmChannel();
      await channel.assertExchange(exchange, topic, {durable: true});
      return channel;
    }

    public publishToExchange(exchange: string, channel: ConfirmChannel, key: string, message: string) {
      return channel.publish(exchange, key, Buffer.from(message), {persistent: true});
    }

    public async consumeFromExchange(exchange: string, topic: string, channel: ConfirmChannel): Promise<any> {
      await channel.assertExchange(exchange, topic, {durable: true});
      const queue: Replies.AssertQueue = await channel.assertQueue('', { exclusive: true });
      await channel.bindQueue(queue.queue, exchange, topic);
      return await channel.consume(queue.queue, (msg) => {
        return msg?.content.toString();
      })
    }
}

const messageQueue = new MessageQueue();
messageQueue.createConnection();
export default messageQueue;

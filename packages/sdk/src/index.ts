export interface XIAOBoard {
  name: string;
  microcontroller: string;
  flashSize: string;
  ramSize: string;
  pins: {
    digital: number[];
    analog: number[];
    pwm: number[];
    i2c: Array<{ sda: number; scl: number }>;
    spi: Array<{ mosi: number; miso: number; sck: number; cs: number }>;
    uart: Array<{ tx: number; rx: number }>;
  };
  features: string[];
}

export interface XIAOExample {
  title: string;
  description: string;
  language: 'arduino' | 'micropython' | 'circuitpython';
  board: string;
  code: string;
  requirements?: string[];
}

export class XIAOAssistant {
  private boards: Map<string, XIAOBoard> = new Map();

  constructor() {
    this.initializeBoards();
  }

  private initializeBoards() {
    // XIAO ESP32C3
    this.boards.set('esp32c3', {
      name: 'XIAO ESP32C3',
      microcontroller: 'ESP32-C3',
      flashSize: '4MB',
      ramSize: '400KB',
      pins: {
        digital: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 21],
        analog: [0, 1, 2, 3, 4],
        pwm: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 21],
        i2c: [{ sda: 6, scl: 7 }],
        spi: [{ mosi: 9, miso: 8, sck: 10, cs: 3 }],
        uart: [{ tx: 21, rx: 20 }]
      },
      features: ['WiFi', 'Bluetooth LE', 'USB-C', 'Battery charging']
    });

    // Add more boards...
  }

  getBoard(boardName: string): XIAOBoard | undefined {
    return this.boards.get(boardName.toLowerCase());
  }

  getAllBoards(): XIAOBoard[] {
    return Array.from(this.boards.values());
  }

  searchExamples(query: string): XIAOExample[] {
    // TODO: Implement example search
    return [];
  }

  getPinout(boardName: string): string {
    const board = this.getBoard(boardName);
    if (!board) {
      throw new Error(`Board ${boardName} not found`);
    }

    return `
XIAO ${board.name} Pinout:
========================
Digital Pins: ${board.pins.digital.join(', ')}
Analog Pins: ${board.pins.analog.join(', ')}
PWM Pins: ${board.pins.pwm.join(', ')}
I2C: SDA=${board.pins.i2c[0]?.sda}, SCL=${board.pins.i2c[0]?.scl}
SPI: MOSI=${board.pins.spi[0]?.mosi}, MISO=${board.pins.spi[0]?.miso}, SCK=${board.pins.spi[0]?.sck}, CS=${board.pins.spi[0]?.cs}
UART: TX=${board.pins.uart[0]?.tx}, RX=${board.pins.uart[0]?.rx}
Features: ${board.features.join(', ')}
    `.trim();
  }
}

export default XIAOAssistant;
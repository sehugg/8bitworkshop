
export class ELFParser {
    readonly dataView: DataView;
    readonly sectionHeaders: ElfSectionHeader[];
    readonly symbolTable: ElfSymbolTableEntry[];
    entry: number;

    constructor(data: Uint8Array) {
        this.dataView = new DataView(data.buffer);
        this.sectionHeaders = [];
        this.symbolTable = [];
        this.parse();
    }

    private parse() {
        const elfHeader = new DataView(this.dataView.buffer, 0, 52);
        // check magic #
        const magic = elfHeader.getInt32(0, true);
        if (magic !== 0x464c457f) {
            throw new Error('Invalid ELF header');
        }
        // only 32 bit supported
        if (elfHeader.getUint8(4) !== 1) {
            throw new Error('Only 32-bit ELF supported');
        }
        // check version = 1
        if (elfHeader.getUint8(6) !== 1) {
            throw new Error('Invalid ELF version');
        }
        // get endianness
        const endian = elfHeader.getUint8(5) === 1;
        if (!endian) {
            throw new Error('Big endian not supported');
        }
        // get entryPoint
        this.entry = elfHeader.getUint32(24, endian);

        // Parse ELF header and extract section header offset
        const sectionHeaderOffset = this.dataView.getUint32(32, endian);
        // get section header size
        const sectionHeaderSize = this.dataView.getUint16(46, endian);
        // get # of section headers
        const sectionHeaderCount = this.dataView.getUint16(48, endian);
        // get index of section with names
        const sectionNameIndex = this.dataView.getUint16(50, endian);

        // Parse section headers
        for (let i = 0; i < sectionHeaderCount; i++) {
            const offset = sectionHeaderOffset + i * sectionHeaderSize; // Each section header is 40 bytes
            //const sectionView = new DataView(this.dataView.buffer, offset, sectionHeaderSize);
            const section = new ElfSectionHeader(this.dataView, offset);
            this.sectionHeaders.push(section);
        }
        const sectionNameSection = this.sectionHeaders[sectionNameIndex];
        if (!sectionNameSection) {
            throw new Error('Invalid ELF section name table');
        } else {
            const stringTableOffset = sectionNameSection.offset;
            const stringTableSize = sectionNameSection.size;
            const sectionNameView = new DataView(this.dataView.buffer, stringTableOffset, stringTableSize);
            for (let i = 0; i < sectionHeaderCount; i++) {
                this.sectionHeaders[i].stringView = sectionNameView;
            }
        }

        // Extract the string table
        const stringTableSection = this.sectionHeaders.find(
            (section) => section.type === ElfSectionType.STRTAB && section.name == '.strtab'
        );
        if (stringTableSection) {
            const stringTableOffset = stringTableSection.offset;
            const stringTableSize = stringTableSection.size;
            const stringView = new DataView(this.dataView.buffer, stringTableOffset, stringTableSize);
            // Find the symbol table section and string table section
            const symbolTableSection = this.sectionHeaders.find(
                (section) => section.name === '.symtab'
            );
            if (symbolTableSection) {
                // Extract the symbol table
                const symbolTableOffset = symbolTableSection.offset;
                const symbolTableSize = symbolTableSection.size;
                const symbolTableEntryCount = symbolTableSize / 16;
                //const symbolTable = new DataView(this.dataView.buffer, symbolTableOffset, symbolTableSize);
                for (let i = 0; i < symbolTableEntryCount; i++) {
                    const offset = symbolTableOffset + i * 16;
                    const entry = new ElfSymbolTableEntry(this.dataView, offset, stringView);
                    this.symbolTable.push(entry);
                }
            }
        }
    }

    getSymbols(): ElfSymbolTableEntry[] {
        return this.symbolTable;
    }
}

enum ElfSectionType {
    SYMTAB = 2,
    STRTAB = 3,
}

class ElfSectionHeader {
    readonly type: number;
    stringView: DataView | null = null;

    constructor(readonly dataView: DataView, readonly headerOffset: number) {
        this.type = this.dataView.getUint32(this.headerOffset + 0x4, true);
    }
    get offset(): number {
        return this.dataView.getUint32(this.headerOffset + 0x10, true);
    }
    get size(): number {
        return this.dataView.getUint32(this.headerOffset + 0x14, true);
    }
    get nameOffset(): number {
        return this.dataView.getUint32(this.headerOffset + 0x0, true);
    }
    get name(): string {
        return getUTF8(this.stringView!, this.nameOffset);
    }
    get vaddr(): number {
        return this.dataView.getUint32(this.headerOffset + 0xc, true);
    }
}

class ElfSymbolTableEntry {
    constructor(readonly dataView: DataView,
        readonly entryOffset: number,
        readonly stringView: DataView) {
    }

    get nameOffset(): number {
        return this.dataView.getUint32(this.entryOffset, true);
    }
    get name(): string {
        return getUTF8(this.stringView, this.nameOffset);
    }
    get value(): number {
        return this.dataView.getUint32(this.entryOffset + 4, true);
    }
    get size(): number {
        return this.dataView.getUint32(this.entryOffset + 8, true);
    }
    get info(): number {
        return this.dataView.getUint8(this.entryOffset + 12);
    }
    get other(): number {
        return this.dataView.getUint8(this.entryOffset + 13);
    }
}

function getUTF8(view: DataView, offset: number): string {
    let str = '';
    for (let i = offset; view.getUint8(i) !== 0; i++) {
        str += String.fromCharCode(view.getUint8(i));
    }
    return str;
}
/*
 * Copyright (c) 2024 Steven E. Hugg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

function getASCII(view: DataView, offset: number): string {
    let s = '';
    let i = offset;
    while (view.getUint8(i) !== 0) {
        s += String.fromCharCode(view.getUint8(i));
        i++;
    }
    return s;
}

// https://blog.k3170makan.com/2018/09/introduction-to-elf-format-elf-header.html
// https://chromium.googlesource.com/breakpad/breakpad/+/linux-dwarf/src/common/dwarf/dwarf2reader.cc
// https://wiki.osdev.org/DWARF
// https://dwarfstd.org/doc/dwarf-2.0.0.pdf
// https://dwarfstd.org/doc/Debugging%20using%20DWARF-2012.pdf
// https://dwarfstd.org/doc/DWARF5.pdf

export class ELFParser {
    readonly dataView: DataView;
    readonly sectionHeaders: ElfSectionHeader[];
    readonly symbolTable: ElfSymbolTableEntry[];
    readonly entry: number;

    constructor(data: Uint8Array) {
        this.dataView = new DataView(data.buffer);
        this.sectionHeaders = [];
        this.symbolTable = [];

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
            const sectionNameView = sectionNameSection.contents;
            for (let i = 0; i < sectionHeaderCount; i++) {
                this.sectionHeaders[i].stringView = sectionNameView;
            }
        }

        // Extract the string table
        const stringTableSection = this.getSection('.strtab', ElfSectionType.STRTAB);
        if (stringTableSection) {
            const stringView = stringTableSection.contents;
            // Find the symbol table section and string table section
            const symbolTableSection = this.getSection('.symtab', ElfSectionType.SYMTAB);
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

    getSection(name: string, type?: number): ElfSectionHeader | null {
        if (typeof type === 'number') {
            return this.sectionHeaders.find((section) => section.name === name && section.type === type) || null;
        } else {
            return this.sectionHeaders.find((section) => section.name === name) || null;
        }
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
    get flags(): number {
        return this.dataView.getUint32(this.headerOffset + 0x8, true);
    }
    get vmaddr(): number {
        return this.dataView.getUint32(this.headerOffset + 0xc, true);
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
        return getASCII(this.stringView!, this.nameOffset);
    }
    get contents(): DataView {
        return new DataView(this.dataView.buffer, this.offset, this.size);
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
        return getASCII(this.stringView, this.nameOffset);
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

// Tag names and codes.
enum DwarfTag {
    DW_TAG_padding = 0x00,
    DW_TAG_array_type = 0x01,
    DW_TAG_class_type = 0x02,
    DW_TAG_entry_point = 0x03,
    DW_TAG_enumeration_type = 0x04,
    DW_TAG_formal_parameter = 0x05,
    DW_TAG_imported_declaration = 0x08,
    DW_TAG_label = 0x0a,
    DW_TAG_lexical_block = 0x0b,
    DW_TAG_member = 0x0d,
    DW_TAG_pointer_type = 0x0f,
    DW_TAG_reference_type = 0x10,
    DW_TAG_compile_unit = 0x11,
    DW_TAG_string_type = 0x12,
    DW_TAG_structure_type = 0x13,
    DW_TAG_subroutine_type = 0x15,
    DW_TAG_typedef = 0x16,
    DW_TAG_union_type = 0x17,
    DW_TAG_unspecified_parameters = 0x18,
    DW_TAG_variant = 0x19,
    DW_TAG_common_block = 0x1a,
    DW_TAG_common_inclusion = 0x1b,
    DW_TAG_inheritance = 0x1c,
    DW_TAG_inlined_subroutine = 0x1d,
    DW_TAG_module = 0x1e,
    DW_TAG_ptr_to_member_type = 0x1f,
    DW_TAG_set_type = 0x20,
    DW_TAG_subrange_type = 0x21,
    DW_TAG_with_stmt = 0x22,
    DW_TAG_access_declaration = 0x23,
    DW_TAG_base_type = 0x24,
    DW_TAG_catch_block = 0x25,
    DW_TAG_const_type = 0x26,
    DW_TAG_constant = 0x27,
    DW_TAG_enumerator = 0x28,
    DW_TAG_file_type = 0x29,
    DW_TAG_friend = 0x2a,
    DW_TAG_namelist = 0x2b,
    DW_TAG_namelist_item = 0x2c,
    DW_TAG_packed_type = 0x2d,
    DW_TAG_subprogram = 0x2e,
    DW_TAG_template_type_param = 0x2f,
    DW_TAG_template_value_param = 0x30,
    DW_TAG_thrown_type = 0x31,
    DW_TAG_try_block = 0x32,
    DW_TAG_variant_part = 0x33,
    DW_TAG_variable = 0x34,
    DW_TAG_volatile_type = 0x35,
    // DWARF 3.
    DW_TAG_dwarf_procedure = 0x36,
    DW_TAG_restrict_type = 0x37,
    DW_TAG_interface_type = 0x38,
    DW_TAG_namespace = 0x39,
    DW_TAG_imported_module = 0x3a,
    DW_TAG_unspecified_type = 0x3b,
    DW_TAG_partial_unit = 0x3c,
    DW_TAG_imported_unit = 0x3d,
    // SGI/MIPS Extensions.
    DW_TAG_MIPS_loop = 0x4081,
    // HP extensions.  See:
    // ftp://ftp.hp.com/pub/lang/tools/WDB/wdb-4.0.tar.gz
    DW_TAG_HP_array_descriptor = 0x4090,
    // GNU extensions.
    DW_TAG_format_label = 0x4101,  // For FORTRAN 77 and Fortran 90.
    DW_TAG_function_template = 0x4102,  // For C++.
    DW_TAG_class_template = 0x4103,  // For C++.
    DW_TAG_GNU_BINCL = 0x4104,
    DW_TAG_GNU_EINCL = 0x4105,
    // Extensions for UPC.  See: http://upc.gwu.edu/~upc.
    DW_TAG_upc_shared_type = 0x8765,
    DW_TAG_upc_strict_type = 0x8766,
    DW_TAG_upc_relaxed_type = 0x8767,
    // PGI (STMicroelectronics) extensions.  No documentation available.
    DW_TAG_PGI_kanji_type = 0xA000,
    DW_TAG_PGI_interface_block = 0xA020
};
enum DwarfHasChild {
    DW_children_no = 0,
    DW_children_yes = 1
};
// Form names and codes.
enum DwarfForm {
    DW_FORM_addr = 0x01,
    DW_FORM_block2 = 0x03,
    DW_FORM_block4 = 0x04,
    DW_FORM_data2 = 0x05,
    DW_FORM_data4 = 0x06,
    DW_FORM_data8 = 0x07,
    DW_FORM_string = 0x08,
    DW_FORM_block = 0x09,
    DW_FORM_block1 = 0x0a,
    DW_FORM_data1 = 0x0b,
    DW_FORM_flag = 0x0c,
    DW_FORM_sdata = 0x0d,
    DW_FORM_strp = 0x0e,
    DW_FORM_udata = 0x0f,
    DW_FORM_ref_addr = 0x10,
    DW_FORM_ref1 = 0x11,
    DW_FORM_ref2 = 0x12,
    DW_FORM_ref4 = 0x13,
    DW_FORM_ref8 = 0x14,
    DW_FORM_ref_udata = 0x15,
    DW_FORM_indirect = 0x16
};
// Attribute names and codes
enum DwarfAttribute {
    DW_AT_sibling = 0x01,
    DW_AT_location = 0x02,
    DW_AT_name = 0x03,
    DW_AT_ordering = 0x09,
    DW_AT_subscr_data = 0x0a,
    DW_AT_byte_size = 0x0b,
    DW_AT_bit_offset = 0x0c,
    DW_AT_bit_size = 0x0d,
    DW_AT_element_list = 0x0f,
    DW_AT_stmt_list = 0x10,
    DW_AT_low_pc = 0x11,
    DW_AT_high_pc = 0x12,
    DW_AT_language = 0x13,
    DW_AT_member = 0x14,
    DW_AT_discr = 0x15,
    DW_AT_discr_value = 0x16,
    DW_AT_visibility = 0x17,
    DW_AT_import = 0x18,
    DW_AT_string_length = 0x19,
    DW_AT_common_reference = 0x1a,
    DW_AT_comp_dir = 0x1b,
    DW_AT_const_value = 0x1c,
    DW_AT_containing_type = 0x1d,
    DW_AT_default_value = 0x1e,
    DW_AT_inline = 0x20,
    DW_AT_is_optional = 0x21,
    DW_AT_lower_bound = 0x22,
    DW_AT_producer = 0x25,
    DW_AT_prototyped = 0x27,
    DW_AT_return_addr = 0x2a,
    DW_AT_start_scope = 0x2c,
    DW_AT_stride_size = 0x2e,
    DW_AT_upper_bound = 0x2f,
    DW_AT_abstract_origin = 0x31,
    DW_AT_accessibility = 0x32,
    DW_AT_address_class = 0x33,
    DW_AT_artificial = 0x34,
    DW_AT_base_types = 0x35,
    DW_AT_calling_convention = 0x36,
    DW_AT_count = 0x37,
    DW_AT_data_member_location = 0x38,
    DW_AT_decl_column = 0x39,
    DW_AT_decl_file = 0x3a,
    DW_AT_decl_line = 0x3b,
    DW_AT_declaration = 0x3c,
    DW_AT_discr_list = 0x3d,
    DW_AT_encoding = 0x3e,
    DW_AT_external = 0x3f,
    DW_AT_frame_base = 0x40,
    DW_AT_friend = 0x41,
    DW_AT_identifier_case = 0x42,
    DW_AT_macro_info = 0x43,
    DW_AT_namelist_items = 0x44,
    DW_AT_priority = 0x45,
    DW_AT_segment = 0x46,
    DW_AT_specification = 0x47,
    DW_AT_static_link = 0x48,
    DW_AT_type = 0x49,
    DW_AT_use_location = 0x4a,
    DW_AT_variable_parameter = 0x4b,
    DW_AT_virtuality = 0x4c,
    DW_AT_vtable_elem_location = 0x4d,
    // DWARF 3 values.
    DW_AT_allocated = 0x4e,
    DW_AT_associated = 0x4f,
    DW_AT_data_location = 0x50,
    DW_AT_stride = 0x51,
    DW_AT_entry_pc = 0x52,
    DW_AT_use_UTF8 = 0x53,
    DW_AT_extension = 0x54,
    DW_AT_ranges = 0x55,
    DW_AT_trampoline = 0x56,
    DW_AT_call_column = 0x57,
    DW_AT_call_file = 0x58,
    DW_AT_call_line = 0x59,
    // SGI/MIPS extensions.
    DW_AT_MIPS_fde = 0x2001,
    DW_AT_MIPS_loop_begin = 0x2002,
    DW_AT_MIPS_tail_loop_begin = 0x2003,
    DW_AT_MIPS_epilog_begin = 0x2004,
    DW_AT_MIPS_loop_unroll_factor = 0x2005,
    DW_AT_MIPS_software_pipeline_depth = 0x2006,
    DW_AT_MIPS_linkage_name = 0x2007,
    DW_AT_MIPS_stride = 0x2008,
    DW_AT_MIPS_abstract_name = 0x2009,
    DW_AT_MIPS_clone_origin = 0x200a,
    DW_AT_MIPS_has_inlines = 0x200b,
    // HP extensions.
    DW_AT_HP_block_index = 0x2000,
    DW_AT_HP_unmodifiable = 0x2001,  // Same as DW_AT_MIPS_fde.
    DW_AT_HP_actuals_stmt_list = 0x2010,
    DW_AT_HP_proc_per_section = 0x2011,
    DW_AT_HP_raw_data_ptr = 0x2012,
    DW_AT_HP_pass_by_reference = 0x2013,
    DW_AT_HP_opt_level = 0x2014,
    DW_AT_HP_prof_version_id = 0x2015,
    DW_AT_HP_opt_flags = 0x2016,
    DW_AT_HP_cold_region_low_pc = 0x2017,
    DW_AT_HP_cold_region_high_pc = 0x2018,
    DW_AT_HP_all_variables_modifiable = 0x2019,
    DW_AT_HP_linkage_name = 0x201a,
    DW_AT_HP_prof_flags = 0x201b,  // In comp unit of procs_info for -g.
    // GNU extensions.
    DW_AT_sf_names = 0x2101,
    DW_AT_src_info = 0x2102,
    DW_AT_mac_info = 0x2103,
    DW_AT_src_coords = 0x2104,
    DW_AT_body_begin = 0x2105,
    DW_AT_body_end = 0x2106,
    DW_AT_GNU_vector = 0x2107,
    // VMS extensions.
    DW_AT_VMS_rtnbeg_pd_address = 0x2201,
    // UPC extension.
    DW_AT_upc_threads_scaled = 0x3210,
    // PGI (STMicroelectronics) extensions.
    DW_AT_PGI_lbase = 0x3a00,
    DW_AT_PGI_soffset = 0x3a01,
    DW_AT_PGI_lstride = 0x3a02
};
// Line number opcodes.
enum DwarfLineNumberOps {
    DW_LNS_extended_op = 0,
    DW_LNS_copy = 1,
    DW_LNS_advance_pc = 2,
    DW_LNS_advance_line = 3,
    DW_LNS_set_file = 4,
    DW_LNS_set_column = 5,
    DW_LNS_negate_stmt = 6,
    DW_LNS_set_basic_block = 7,
    DW_LNS_const_add_pc = 8,
    DW_LNS_fixed_advance_pc = 9,
    // DWARF 3.
    DW_LNS_set_prologue_end = 10,
    DW_LNS_set_epilogue_begin = 11,
    DW_LNS_set_isa = 12
};
// Line number extended opcodes.
enum DwarfLineNumberExtendedOps {
    DW_LNE_end_sequence = 1,
    DW_LNE_set_address = 2,
    DW_LNE_define_file = 3,
    // HP extensions.
    DW_LNE_HP_negate_is_UV_update = 0x11,
    DW_LNE_HP_push_context = 0x12,
    DW_LNE_HP_pop_context = 0x13,
    DW_LNE_HP_set_file_line_column = 0x14,
    DW_LNE_HP_set_routine_name = 0x15,
    DW_LNE_HP_set_sequence = 0x16,
    DW_LNE_HP_negate_post_semantics = 0x17,
    DW_LNE_HP_negate_function_exit = 0x18,
    DW_LNE_HP_negate_front_end_logical = 0x19,
    DW_LNE_HP_define_proc = 0x20
};
// Type encoding names and codes
enum DwarfEncoding {
    DW_ATE_address = 0x1,
    DW_ATE_boolean = 0x2,
    DW_ATE_complex_float = 0x3,
    DW_ATE_float = 0x4,
    DW_ATE_signed = 0x5,
    DW_ATE_signed_char = 0x6,
    DW_ATE_unsigned = 0x7,
    DW_ATE_unsigned_char = 0x8,
    // DWARF3/DWARF3f
    DW_ATE_imaginary_float = 0x9,
    DW_ATE_packed_decimal = 0xa,
    DW_ATE_numeric_string = 0xb,
    DW_ATE_edited = 0xc,
    DW_ATE_signed_fixed = 0xd,
    DW_ATE_unsigned_fixed = 0xe,
    DW_ATE_decimal_float = 0xf,
    DW_ATE_lo_user = 0x80,
    DW_ATE_hi_user = 0xff
};
// Location virtual machine opcodes
enum DwarfOpcode {
    DW_OP_addr = 0x03,
    DW_OP_deref = 0x06,
    DW_OP_const1u = 0x08,
    DW_OP_const1s = 0x09,
    DW_OP_const2u = 0x0a,
    DW_OP_const2s = 0x0b,
    DW_OP_const4u = 0x0c,
    DW_OP_const4s = 0x0d,
    DW_OP_const8u = 0x0e,
    DW_OP_const8s = 0x0f,
    DW_OP_constu = 0x10,
    DW_OP_consts = 0x11,
    DW_OP_dup = 0x12,
    DW_OP_drop = 0x13,
    DW_OP_over = 0x14,
    DW_OP_pick = 0x15,
    DW_OP_swap = 0x16,
    DW_OP_rot = 0x17,
    DW_OP_xderef = 0x18,
    DW_OP_abs = 0x19,
    DW_OP_and = 0x1a,
    DW_OP_div = 0x1b,
    DW_OP_minus = 0x1c,
    DW_OP_mod = 0x1d,
    DW_OP_mul = 0x1e,
    DW_OP_neg = 0x1f,
    DW_OP_not = 0x20,
    DW_OP_or = 0x21,
    DW_OP_plus = 0x22,
    DW_OP_plus_uconst = 0x23,
    DW_OP_shl = 0x24,
    DW_OP_shr = 0x25,
    DW_OP_shra = 0x26,
    DW_OP_xor = 0x27,
    DW_OP_bra = 0x28,
    DW_OP_eq = 0x29,
    DW_OP_ge = 0x2a,
    DW_OP_gt = 0x2b,
    DW_OP_le = 0x2c,
    DW_OP_lt = 0x2d,
    DW_OP_ne = 0x2e,
    DW_OP_skip = 0x2f,
    DW_OP_lit0 = 0x30,
    DW_OP_lit1 = 0x31,
    DW_OP_lit2 = 0x32,
    DW_OP_lit3 = 0x33,
    DW_OP_lit4 = 0x34,
    DW_OP_lit5 = 0x35,
    DW_OP_lit6 = 0x36,
    DW_OP_lit7 = 0x37,
    DW_OP_lit8 = 0x38,
    DW_OP_lit9 = 0x39,
    DW_OP_lit10 = 0x3a,
    DW_OP_lit11 = 0x3b,
    DW_OP_lit12 = 0x3c,
    DW_OP_lit13 = 0x3d,
    DW_OP_lit14 = 0x3e,
    DW_OP_lit15 = 0x3f,
    DW_OP_lit16 = 0x40,
    DW_OP_lit17 = 0x41,
    DW_OP_lit18 = 0x42,
    DW_OP_lit19 = 0x43,
    DW_OP_lit20 = 0x44,
    DW_OP_lit21 = 0x45,
    DW_OP_lit22 = 0x46,
    DW_OP_lit23 = 0x47,
    DW_OP_lit24 = 0x48,
    DW_OP_lit25 = 0x49,
    DW_OP_lit26 = 0x4a,
    DW_OP_lit27 = 0x4b,
    DW_OP_lit28 = 0x4c,
    DW_OP_lit29 = 0x4d,
    DW_OP_lit30 = 0x4e,
    DW_OP_lit31 = 0x4f,
    DW_OP_reg0 = 0x50,
    DW_OP_reg1 = 0x51,
    DW_OP_reg2 = 0x52,
    DW_OP_reg3 = 0x53,
    DW_OP_reg4 = 0x54,
    DW_OP_reg5 = 0x55,
    DW_OP_reg6 = 0x56,
    DW_OP_reg7 = 0x57,
    DW_OP_reg8 = 0x58,
    DW_OP_reg9 = 0x59,
    DW_OP_reg10 = 0x5a,
    DW_OP_reg11 = 0x5b,
    DW_OP_reg12 = 0x5c,
    DW_OP_reg13 = 0x5d,
    DW_OP_reg14 = 0x5e,
    DW_OP_reg15 = 0x5f,
    DW_OP_reg16 = 0x60,
    DW_OP_reg17 = 0x61,
    DW_OP_reg18 = 0x62,
    DW_OP_reg19 = 0x63,
    DW_OP_reg20 = 0x64,
    DW_OP_reg21 = 0x65,
    DW_OP_reg22 = 0x66,
    DW_OP_reg23 = 0x67,
    DW_OP_reg24 = 0x68,
    DW_OP_reg25 = 0x69,
    DW_OP_reg26 = 0x6a,
    DW_OP_reg27 = 0x6b,
    DW_OP_reg28 = 0x6c,
    DW_OP_reg29 = 0x6d,
    DW_OP_reg30 = 0x6e,
    DW_OP_reg31 = 0x6f,
    DW_OP_breg0 = 0x70,
    DW_OP_breg1 = 0x71,
    DW_OP_breg2 = 0x72,
    DW_OP_breg3 = 0x73,
    DW_OP_breg4 = 0x74,
    DW_OP_breg5 = 0x75,
    DW_OP_breg6 = 0x76,
    DW_OP_breg7 = 0x77,
    DW_OP_breg8 = 0x78,
    DW_OP_breg9 = 0x79,
    DW_OP_breg10 = 0x7a,
    DW_OP_breg11 = 0x7b,
    DW_OP_breg12 = 0x7c,
    DW_OP_breg13 = 0x7d,
    DW_OP_breg14 = 0x7e,
    DW_OP_breg15 = 0x7f,
    DW_OP_breg16 = 0x80,
    DW_OP_breg17 = 0x81,
    DW_OP_breg18 = 0x82,
    DW_OP_breg19 = 0x83,
    DW_OP_breg20 = 0x84,
    DW_OP_breg21 = 0x85,
    DW_OP_breg22 = 0x86,
    DW_OP_breg23 = 0x87,
    DW_OP_breg24 = 0x88,
    DW_OP_breg25 = 0x89,
    DW_OP_breg26 = 0x8a,
    DW_OP_breg27 = 0x8b,
    DW_OP_breg28 = 0x8c,
    DW_OP_breg29 = 0x8d,
    DW_OP_breg30 = 0x8e,
    DW_OP_breg31 = 0x8f,
    DW_OP_regX = 0x90,
    DW_OP_fbreg = 0x91,
    DW_OP_bregX = 0x92,
    DW_OP_piece = 0x93,
    DW_OP_deref_size = 0x94,
    DW_OP_xderef_size = 0x95,
    DW_OP_nop = 0x96,
    // DWARF3/DWARF3f
    DW_OP_push_object_address = 0x97,
    DW_OP_call2 = 0x98,
    DW_OP_call4 = 0x99,
    DW_OP_call_ref = 0x9a,
    DW_OP_form_tls_address = 0x9b,
    DW_OP_call_frame_cfa = 0x9c,
    DW_OP_bit_piece = 0x9d,
    DW_OP_lo_user = 0xe0,
    DW_OP_hi_user = 0xff,
    // GNU extensions
    DW_OP_GNU_push_tls_address = 0xe0
};
// Source languages.  These are values for DW_AT_language.
enum DwarfLanguage {
    DW_LANG_none = 0x0000,
    DW_LANG_C89 = 0x0001,
    DW_LANG_C = 0x0002,
    DW_LANG_Ada83 = 0x0003,
    DW_LANG_C_plus_plus = 0x0004,
    DW_LANG_Cobol74 = 0x0005,
    DW_LANG_Cobol85 = 0x0006,
    DW_LANG_Fortran77 = 0x0007,
    DW_LANG_Fortran90 = 0x0008,
    DW_LANG_Pascal83 = 0x0009,
    DW_LANG_Modula2 = 0x000a,
    DW_LANG_Java = 0x000b,
    DW_LANG_C99 = 0x000c,
    DW_LANG_Ada95 = 0x000d,
    DW_LANG_Fortran95 = 0x000e,
    DW_LANG_PLI = 0x000f,
    DW_LANG_ObjC = 0x0010,
    DW_LANG_ObjC_plus_plus = 0x0011,
    DW_LANG_UPC = 0x0012,
    DW_LANG_D = 0x0013,
    // Implementation-defined language code range.
    DW_LANG_lo_user = 0x8000,
    DW_LANG_hi_user = 0xffff,
    // Extensions.
    // MIPS assembly language.  The GNU toolchain uses this for all
    // assembly languages, since there's no generic DW_LANG_ value for that.
    DW_LANG_Mips_Assembler = 0x8001,
    DW_LANG_Upc = 0x8765 // Unified Parallel C
};

class ByteReader {
    addressSize: number = 4;
    offsetSize: number = 4;
    offset: number = 0;

    constructor(readonly view: DataView, readonly littleEndian: boolean) {
    }

    isEOF(): boolean {
        return this.offset >= this.view.byteLength;
    }

    readOneByte(): number {
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readTwoBytes(): number {
        const value = this.view.getUint16(this.offset, this.littleEndian);
        this.offset += 2;
        return value;
    }

    readFourBytes(): number {
        const value = this.view.getUint32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }

    readEightBytes(): bigint {
        const value = this.view.getBigUint64(this.offset, this.littleEndian);
        this.offset += 8;
        return value;
    }

    readUnsignedLEB128(): number | bigint {
        let result = BigInt(0);
        let shift = BigInt(0);
        while (true) {
            const byte = this.readOneByte();
            result |= BigInt(byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) {
                break;
            }
            shift += BigInt(7);
        }
        return shift < 31 ? Number(result) : result;
    }

    readSignedLEB128(): number | bigint {
        let result = BigInt(0);
        let shift = BigInt(0);
        let byte = 0;
        while (true) {
            byte = this.readOneByte();
            result |= BigInt(byte & 0x7f) << shift;
            shift += BigInt(7);
            if ((byte & 0x80) === 0) {
                break;
            }
        }
        if ((byte & 0x40) !== 0) {
            // Sign extend if the highest bit of the last byte is set.
            result |= -(BigInt(1) << shift);
        }
        return shift < 31 ? Number(result) : result;
    }

    readOffset(): number {
        if (this.offsetSize === 4) {
            const value = this.readFourBytes();
            return value;
            /*
        } else if (this.offsetSize === 8) {
            const value = this.readEightBytes();
            return value;
            */
        } else {
            throw new Error('Invalid offset size');
        }
    }

    readAddress(): number {
        if (this.addressSize === 4) {
            const value = this.readFourBytes();
            return value;
            /*
        } else if (this.addressSize === 8) {
            const value = this.readEightBytes();
            return value;
            */
        } else {
            throw new Error('Invalid address size');
        }
    }
    readInitialLength(): number {
        const initial_length = this.readFourBytes();
        // In DWARF2/3, if the initial length is all 1 bits, then the offset
        // size is 8 and we need to read the next 8 bytes for the real length.
        if (initial_length === 0xffffffff) {
            throw new Error('64-bit DWARF is not supported');
            //this.offsetSize = 8;
            //return this.readEightBytes();
        } else {
            this.offsetSize = 4;
            return initial_length;
        }
    }
    readString(): string {
        let result = '';
        while (true) {
            const byte = this.readOneByte();
            if (byte === 0) {
                break;
            }
            result += String.fromCharCode(byte);
        }
        return result;
    }
    slice(offset: number, length: number): DataView {
        return new DataView(this.view.buffer, this.view.byteOffset + offset, length);
    }
    readByteArray(length: number): Uint8Array {
        const result = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = this.readOneByte();
        }
        return result;
    }
}

export class DWARFParser {

    units: DWARFCompilationUnit[] = [];
    lineInfos: DWARFLineInfo[] = [];

    constructor(readonly elf: ELFParser) {
        // fetch DWARF v2 sections
        //this.aranges = elf.getSection('.debug_aranges');
        // parse compilation units
        const abbrev = elf.getSection('.debug_abbrev');
        const info = elf.getSection('.debug_info');
        const debugstrs = elf.getSection('.debug_str') || elf.getSection('__debug_str');
        const infoReader = new ByteReader(info.contents, true);
        while (!infoReader.isEOF()) {
            const compilationUnit = new DWARFCompilationUnit(infoReader, debugstrs.contents);
            // must be either skip() or read()
            compilationUnit.read(abbrev.contents);
            this.units.push(compilationUnit);
            compilationUnit.dispose();
        }
        const linedata = elf.getSection('.debug_line');
        const lineReader = new ByteReader(linedata.contents, true);
        while (!lineReader.isEOF()) {
            const lineInfo = new DWARFLineInfo(lineReader);
            // must be either skip() or read()
            lineInfo.readLines();
            this.lineInfos.push(lineInfo);
            lineInfo.dispose();
        }
    }
}

class DWARFCompilationUnit {
    headerLength: number;
    contentLength: number;
    contentOffset: number;
    abbrevOffset: number;
    abbrevs: Abbrev[] = [];
    root: {};

    constructor(protected infoReader: ByteReader, protected debugstrs: DataView) {
        const baseOffset = infoReader.offset;
        const length = infoReader.readInitialLength();
        const version = infoReader.readTwoBytes();
        this.abbrevOffset = Number(infoReader.readOffset());
        const address_size = infoReader.readOneByte();
        this.headerLength = infoReader.offset - baseOffset;
        if (version != 2) throw new Error('DWARF version ' + version + ' not supported');
        if (address_size !== 4) throw new Error('Address size ' + address_size + ' not supported');
        this.contentLength = Number(length) - this.headerLength + 4;
        this.contentOffset = infoReader.offset;
        //const info = new DWARFCompilationUnit(buffer, reader.offset, address_size);
    }
    dispose() {
        this.infoReader = null;
        this.debugstrs = null;
        this.abbrevs = null;
    }
    skip() {
        this.infoReader.offset += this.contentLength;
    }
    read(abbrev: DataView) {
        // parse the abbreviations
        let abbrevReader = new ByteReader(abbrev, true);
        abbrevReader.offset = this.abbrevOffset;
        this.abbrevs = parseAbbrevs(abbrevReader);
        // extract slice with DIEs
        const slice = this.infoReader.slice(this.contentOffset, this.contentLength);
        this.root = this.processDIEs(new ByteReader(slice, true));
        // skip to next cu section
        this.skip();
    }
    processDIEs(reader: ByteReader) {
        let die_stack : any[] = [{children:[]}];
        // TODO: capture tree structure
        while (!reader.isEOF()) {
            let absolute_offset = reader.offset + this.contentOffset;
            let abbrev_num = Number(reader.readUnsignedLEB128());
            //console.log('DIE', absolute_offset.toString(16), abbrev_num);
            if (abbrev_num == 0) {
                let item = die_stack.pop();
                if (!item) throw new Error('DIE stack underflow @ offset ' + reader.offset);
                continue;
            }
            let abbrev = this.abbrevs[abbrev_num - 1];
            if (!abbrev) throw new Error('Invalid abbreviation number ' + abbrev_num);
            let obj = this.processDIE(reader, abbrev);
            let top = die_stack[die_stack.length - 1];
            if (!top.children) top.children = [];
            top.children.push(obj);
            if (abbrev.has_children) {
                die_stack.push(obj);
            }
        }
        if (die_stack.length != 1) throw new Error('DIE stack not empty');
        return die_stack[0];
    }
    processDIE(reader: ByteReader, abbrev: Abbrev) {
        //console.log('processDIE', abbrev);
        let obj = {tag: DwarfTag[abbrev.tag]};
        // iterate through attributes
        for (let attr of abbrev.attributes) {
            let form = attr.form;
            let value = this.processAttribute(reader, form);
            obj[DwarfAttribute[attr.attr]] = value;
        }
        //console.log(obj);
        return obj;
    }
    processAttribute(reader: ByteReader, form: DwarfForm) {
        switch (form) {
            case DwarfForm.DW_FORM_data1:
            case DwarfForm.DW_FORM_flag:
            case DwarfForm.DW_FORM_ref1:
                return reader.readOneByte();
            case DwarfForm.DW_FORM_data2:
            case DwarfForm.DW_FORM_ref2:
                return reader.readTwoBytes();
            case DwarfForm.DW_FORM_data4:
            case DwarfForm.DW_FORM_ref4:
            case DwarfForm.DW_FORM_addr:
            case DwarfForm.DW_FORM_ref_addr:
                return reader.readFourBytes();
            case DwarfForm.DW_FORM_data8:
            case DwarfForm.DW_FORM_ref8:
                return reader.readEightBytes();
            case DwarfForm.DW_FORM_string:
                return reader.readString();
            case DwarfForm.DW_FORM_udata:
            case DwarfForm.DW_FORM_ref_udata:
                return reader.readUnsignedLEB128();
            case DwarfForm.DW_FORM_sdata:
                return reader.readSignedLEB128();
            case DwarfForm.DW_FORM_strp:
                // read from strtab
                let offset = Number(reader.readOffset());
                return this.getStringFrom(this.debugstrs, offset);
            case DwarfForm.DW_FORM_block1:
                let len = reader.readOneByte();
                return reader.readByteArray(len);
            default:
                throw new Error('Unsupported form ' + form);
        }
    }
    getStringFrom(strtab: DataView, offset: number): string {
        let result = '';
        while (true) {
            const byte = strtab.getUint8(offset);
            if (byte === 0) {
                break;
            }
            result += String.fromCharCode(byte);
            offset += 1;
        }
        return result;
    }
}

// https://chromium.googlesource.com/breakpad/breakpad/+/linux-dwarf/src/common/dwarf

interface FunctionInfo {
    name: string;
    mangled_name: string;
    file: string;
    line: number;
    lowpc: number;
    highpc: number;
}

interface SourceFileInfo {
    name: string;
    lowpc: number;
}

interface Abbrev {
    number: number;
    tag: DwarfTag;
    has_children: boolean;
    attributes: { attr: number, form: number }[];
}

class CompilationUnitHeader {
    length = 0
    version = 0
    abbrev_offset = 0;
    address_size = 0;
}


interface LineInfo {
    file: string;
    line: number;
    column: number;
    address: number;
    is_stmt: boolean;
    basic_block: boolean;
    end_sequence: boolean;
}

class LineStateMachine {
    file_num: number;
    address: number;
    line_num: number;
    column_num: number;
    is_stmt: boolean;
    basic_block: boolean;
    end_sequence: boolean;

    constructor(default_is_stmt: boolean) {
        this.Reset(default_is_stmt);
    }

    Reset(default_is_stmt: boolean): void {
        this.file_num = 1;
        this.address = 0;
        this.line_num = 1;
        this.column_num = 0;
        this.is_stmt = default_is_stmt;
        this.basic_block = false;
        this.end_sequence = false;
    }
}

// Read a DWARF2/3 abbreviation section.
// Each abbrev consists of a abbreviation number, a tag, a byte
// specifying whether the tag has children, and a list of
// attribute/form pairs.
// The list of forms is terminated by a 0 for the attribute, and a
// zero for the form.  The entire abbreviation section is terminated
// by a zero for the code.
function parseAbbrevs(reader: ByteReader): Abbrev[] {
    const abbrevs = [];
    while (!reader.isEOF()) {
        const number = Number(reader.readUnsignedLEB128());
        if (number == 0) break;
        const tag = Number(reader.readUnsignedLEB128());
        const has_children = reader.readOneByte() !== 0;
        const attributes = [];
        while (true) {
            const attr = Number(reader.readUnsignedLEB128());
            const form = Number(reader.readUnsignedLEB128());
            if (attr === 0 && form === 0) {
                break;
            }
            attributes.push({ attr, form });
        }
        const abbrev: Abbrev = {
            number,
            tag: tag as DwarfTag,
            has_children,
            attributes,
        };
        abbrevs.push(abbrev);
    }
    return abbrevs;
}

interface DWARFFile {
    dir_index: number;
    name: string;
    mod_time: number;
    file_length: number;
    lines: LineInfo[];
}

class DWARFLineInfo {
    directories: string[];
    files: DWARFFile[];
    contentOffset: number;
    contentLength: number;
    opData: DataView;
    opReader: ByteReader;
    line_base: number;
    line_range: number;
    opcode_base: number;
    min_insn_length: number;
    default_is_stmt: boolean;
    lsm: LineStateMachine;

    constructor(protected headerReader: ByteReader) {
        this.readHeader();
    }
    dispose() {
        this.headerReader = null;
        this.opData = null;
        this.opReader = null;
        this.lsm = null;
    }
    readHeader() {
        const length = this.headerReader.readInitialLength();
        const baseOffset1 = this.headerReader.offset;
        const version = this.headerReader.readTwoBytes();
        if (version != 2) throw new Error('DWARF version ' + version + ' not supported');
        const prologue_length = this.headerReader.readOffset();
        const baseOffset2 = this.headerReader.offset;
        this.min_insn_length = this.headerReader.readOneByte();
        this.default_is_stmt = this.headerReader.readOneByte() !== 0;
        this.line_base = this.headerReader.readOneByte(); // signed
        if (this.line_base >= 0x80) {
            this.line_base -= 0x100;
        }
        this.line_range = this.headerReader.readOneByte();
        const opcode_base = this.opcode_base = this.headerReader.readOneByte();
        const std_opcode_lengths = new Array(opcode_base + 1);
        for (let i = 1; i < opcode_base; i++) {
            std_opcode_lengths[i] = this.headerReader.readOneByte();
        }
        // It is legal for the directory entry table to be empty.
        this.directories = [null];
        while (true) {
            const name = this.headerReader.readString();
            if (name === '') {
                break;
            }
            this.directories.push(name);
        }
        // It is also legal for the file entry table to be empty.
        this.files = [null];
        while (true) {
            const name = this.headerReader.readString();
            if (name === '') {
                break;
            }
            const dir_index = Number(this.headerReader.readUnsignedLEB128());
            const mod_time = Number(this.headerReader.readUnsignedLEB128());
            const file_length = Number(this.headerReader.readUnsignedLEB128());
            this.files.push({ name, dir_index, mod_time, file_length, lines: [] });
        }
        this.contentOffset = baseOffset2 + Number(prologue_length);
        this.contentLength = Number(length) - (this.contentOffset - baseOffset1);
    }
    skip() {
        this.headerReader.offset = this.contentOffset + this.contentLength;
    }
    readLines() {
        this.opData = this.headerReader.slice(this.contentOffset, this.contentLength);
        this.opReader = new ByteReader(this.opData, true);
        this.lsm = new LineStateMachine(this.default_is_stmt);
        while (!this.opReader.isEOF()) {
            let add_line = this.processOneOpcode();
            if (this.lsm.end_sequence) {
                this.lsm.Reset(this.default_is_stmt);
            } else if (add_line) {
                let line: LineInfo = {
                    file: this.files[this.lsm.file_num].name,
                    line: this.lsm.line_num,
                    column: this.lsm.column_num,
                    address: this.lsm.address,
                    is_stmt: this.lsm.is_stmt,
                    basic_block: this.lsm.basic_block,
                    end_sequence: this.lsm.end_sequence,
                };
                this.files[this.lsm.file_num].lines.push(line);
                //console.log(line);
            }
        }
        this.skip();
    }
    processOneOpcode() : boolean {
        let opcode = this.opReader.readOneByte();
        // If the opcode is great than the opcode_base, it is a special
        // opcode. Most line programs consist mainly of special opcodes.
        if (opcode >= this.opcode_base) {
            opcode -= this.opcode_base;
            let advance_address = Math.floor(opcode / this.line_range) * this.min_insn_length;
            let advance_line = (opcode % this.line_range) + this.line_base;
            this.checkPassPC();
            this.lsm.address += advance_address;
            this.lsm.line_num += advance_line;
            this.lsm.basic_block = true;
            return true;
        }
        // Otherwise, we have the regular opcodes
        //console.log('opcode', opcode, this.lsm);
        switch (opcode) {
            case DwarfLineNumberOps.DW_LNS_copy: {
                this.lsm.basic_block = false;
                return true;
            }
            case DwarfLineNumberOps.DW_LNS_advance_pc: {
                const advance_address = this.opReader.readUnsignedLEB128();
                this.checkPassPC();
                this.lsm.address += this.min_insn_length * Number(advance_address);
                break;
            }
            case DwarfLineNumberOps.DW_LNS_advance_line: {
                this.lsm.line_num += Number(this.opReader.readSignedLEB128());
                break;
            }
            case DwarfLineNumberOps.DW_LNS_set_file: {
                this.lsm.file_num = Number(this.opReader.readUnsignedLEB128());
                break;
            }
            case DwarfLineNumberOps.DW_LNS_set_column: {
                this.lsm.column_num = Number(this.opReader.readUnsignedLEB128());
                break;
            }
            case DwarfLineNumberOps.DW_LNS_negate_stmt: {
                this.lsm.is_stmt = !this.lsm.is_stmt;
                break;
            }
            case DwarfLineNumberOps.DW_LNS_set_basic_block: {
                this.lsm.basic_block = true;
                break;
            }
            case DwarfLineNumberOps.DW_LNS_fixed_advance_pc: {
                const advance_address = this.opReader.readTwoBytes();
                this.checkPassPC();
                this.lsm.address += advance_address;
                break;
            }
            case DwarfLineNumberOps.DW_LNS_const_add_pc: {
                const advance_address = this.min_insn_length * ((255 - this.opcode_base) / this.line_range);
                this.checkPassPC();
                this.lsm.address += advance_address;
                break;
            }
            case DwarfLineNumberOps.DW_LNS_set_prologue_end: {
                break;
            }
            case DwarfLineNumberOps.DW_LNS_set_epilogue_begin: {
                break;
            }
            case DwarfLineNumberOps.DW_LNS_extended_op: {
                const extended_op_len = this.opReader.readUnsignedLEB128();
                const extended_op = this.opReader.readOneByte();
                switch (extended_op) {
                    case DwarfLineNumberExtendedOps.DW_LNE_end_sequence:
                        this.lsm.end_sequence = true;
                        return true;
                    case DwarfLineNumberExtendedOps.DW_LNE_set_address:
                        this.lsm.address = Number(this.opReader.readAddress());
                        break;
                    case DwarfLineNumberExtendedOps.DW_LNE_define_file:
                        // TODO
                        break;
                    default:
                        console.log('Unknown DWARF extended opcode ' + extended_op);
                        this.opReader.offset += Number(extended_op_len);
                        break;
                }
                break;
            }
            default:
                console.log('Unknown DWARF opcode ' + opcode);
                break;
        }
    }
    checkPassPC() {
        /*
        // Check if the lsm passes "pc". If so, mark it as passed.
        if (lsm_passes_pc &&
            lsm->address <= pc && pc < lsm->address + advance_address) {
        *lsm_passes_pc = true;
        }
        */
    }
}

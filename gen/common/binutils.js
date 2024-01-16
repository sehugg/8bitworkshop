"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DWARFParser = exports.ELFParser = void 0;
function getASCII(view, offset) {
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
class ELFParser {
    constructor(data) {
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
        }
        else {
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
    getSymbols() {
        return this.symbolTable;
    }
    getSection(name, type) {
        if (typeof type === 'number') {
            return this.sectionHeaders.find((section) => section.name === name && section.type === type) || null;
        }
        else {
            return this.sectionHeaders.find((section) => section.name === name) || null;
        }
    }
}
exports.ELFParser = ELFParser;
var ElfSectionType;
(function (ElfSectionType) {
    ElfSectionType[ElfSectionType["SYMTAB"] = 2] = "SYMTAB";
    ElfSectionType[ElfSectionType["STRTAB"] = 3] = "STRTAB";
})(ElfSectionType || (ElfSectionType = {}));
class ElfSectionHeader {
    constructor(dataView, headerOffset) {
        this.dataView = dataView;
        this.headerOffset = headerOffset;
        this.stringView = null;
        this.type = this.dataView.getUint32(this.headerOffset + 0x4, true);
    }
    get flags() {
        return this.dataView.getUint32(this.headerOffset + 0x8, true);
    }
    get vmaddr() {
        return this.dataView.getUint32(this.headerOffset + 0xc, true);
    }
    get offset() {
        return this.dataView.getUint32(this.headerOffset + 0x10, true);
    }
    get size() {
        return this.dataView.getUint32(this.headerOffset + 0x14, true);
    }
    get nameOffset() {
        return this.dataView.getUint32(this.headerOffset + 0x0, true);
    }
    get name() {
        return getASCII(this.stringView, this.nameOffset);
    }
    get contents() {
        return new DataView(this.dataView.buffer, this.offset, this.size);
    }
}
class ElfSymbolTableEntry {
    constructor(dataView, entryOffset, stringView) {
        this.dataView = dataView;
        this.entryOffset = entryOffset;
        this.stringView = stringView;
    }
    get nameOffset() {
        return this.dataView.getUint32(this.entryOffset, true);
    }
    get name() {
        return getASCII(this.stringView, this.nameOffset);
    }
    get value() {
        return this.dataView.getUint32(this.entryOffset + 4, true);
    }
    get size() {
        return this.dataView.getUint32(this.entryOffset + 8, true);
    }
    get info() {
        return this.dataView.getUint8(this.entryOffset + 12);
    }
    get other() {
        return this.dataView.getUint8(this.entryOffset + 13);
    }
}
// Tag names and codes.
var DwarfTag;
(function (DwarfTag) {
    DwarfTag[DwarfTag["DW_TAG_padding"] = 0] = "DW_TAG_padding";
    DwarfTag[DwarfTag["DW_TAG_array_type"] = 1] = "DW_TAG_array_type";
    DwarfTag[DwarfTag["DW_TAG_class_type"] = 2] = "DW_TAG_class_type";
    DwarfTag[DwarfTag["DW_TAG_entry_point"] = 3] = "DW_TAG_entry_point";
    DwarfTag[DwarfTag["DW_TAG_enumeration_type"] = 4] = "DW_TAG_enumeration_type";
    DwarfTag[DwarfTag["DW_TAG_formal_parameter"] = 5] = "DW_TAG_formal_parameter";
    DwarfTag[DwarfTag["DW_TAG_imported_declaration"] = 8] = "DW_TAG_imported_declaration";
    DwarfTag[DwarfTag["DW_TAG_label"] = 10] = "DW_TAG_label";
    DwarfTag[DwarfTag["DW_TAG_lexical_block"] = 11] = "DW_TAG_lexical_block";
    DwarfTag[DwarfTag["DW_TAG_member"] = 13] = "DW_TAG_member";
    DwarfTag[DwarfTag["DW_TAG_pointer_type"] = 15] = "DW_TAG_pointer_type";
    DwarfTag[DwarfTag["DW_TAG_reference_type"] = 16] = "DW_TAG_reference_type";
    DwarfTag[DwarfTag["DW_TAG_compile_unit"] = 17] = "DW_TAG_compile_unit";
    DwarfTag[DwarfTag["DW_TAG_string_type"] = 18] = "DW_TAG_string_type";
    DwarfTag[DwarfTag["DW_TAG_structure_type"] = 19] = "DW_TAG_structure_type";
    DwarfTag[DwarfTag["DW_TAG_subroutine_type"] = 21] = "DW_TAG_subroutine_type";
    DwarfTag[DwarfTag["DW_TAG_typedef"] = 22] = "DW_TAG_typedef";
    DwarfTag[DwarfTag["DW_TAG_union_type"] = 23] = "DW_TAG_union_type";
    DwarfTag[DwarfTag["DW_TAG_unspecified_parameters"] = 24] = "DW_TAG_unspecified_parameters";
    DwarfTag[DwarfTag["DW_TAG_variant"] = 25] = "DW_TAG_variant";
    DwarfTag[DwarfTag["DW_TAG_common_block"] = 26] = "DW_TAG_common_block";
    DwarfTag[DwarfTag["DW_TAG_common_inclusion"] = 27] = "DW_TAG_common_inclusion";
    DwarfTag[DwarfTag["DW_TAG_inheritance"] = 28] = "DW_TAG_inheritance";
    DwarfTag[DwarfTag["DW_TAG_inlined_subroutine"] = 29] = "DW_TAG_inlined_subroutine";
    DwarfTag[DwarfTag["DW_TAG_module"] = 30] = "DW_TAG_module";
    DwarfTag[DwarfTag["DW_TAG_ptr_to_member_type"] = 31] = "DW_TAG_ptr_to_member_type";
    DwarfTag[DwarfTag["DW_TAG_set_type"] = 32] = "DW_TAG_set_type";
    DwarfTag[DwarfTag["DW_TAG_subrange_type"] = 33] = "DW_TAG_subrange_type";
    DwarfTag[DwarfTag["DW_TAG_with_stmt"] = 34] = "DW_TAG_with_stmt";
    DwarfTag[DwarfTag["DW_TAG_access_declaration"] = 35] = "DW_TAG_access_declaration";
    DwarfTag[DwarfTag["DW_TAG_base_type"] = 36] = "DW_TAG_base_type";
    DwarfTag[DwarfTag["DW_TAG_catch_block"] = 37] = "DW_TAG_catch_block";
    DwarfTag[DwarfTag["DW_TAG_const_type"] = 38] = "DW_TAG_const_type";
    DwarfTag[DwarfTag["DW_TAG_constant"] = 39] = "DW_TAG_constant";
    DwarfTag[DwarfTag["DW_TAG_enumerator"] = 40] = "DW_TAG_enumerator";
    DwarfTag[DwarfTag["DW_TAG_file_type"] = 41] = "DW_TAG_file_type";
    DwarfTag[DwarfTag["DW_TAG_friend"] = 42] = "DW_TAG_friend";
    DwarfTag[DwarfTag["DW_TAG_namelist"] = 43] = "DW_TAG_namelist";
    DwarfTag[DwarfTag["DW_TAG_namelist_item"] = 44] = "DW_TAG_namelist_item";
    DwarfTag[DwarfTag["DW_TAG_packed_type"] = 45] = "DW_TAG_packed_type";
    DwarfTag[DwarfTag["DW_TAG_subprogram"] = 46] = "DW_TAG_subprogram";
    DwarfTag[DwarfTag["DW_TAG_template_type_param"] = 47] = "DW_TAG_template_type_param";
    DwarfTag[DwarfTag["DW_TAG_template_value_param"] = 48] = "DW_TAG_template_value_param";
    DwarfTag[DwarfTag["DW_TAG_thrown_type"] = 49] = "DW_TAG_thrown_type";
    DwarfTag[DwarfTag["DW_TAG_try_block"] = 50] = "DW_TAG_try_block";
    DwarfTag[DwarfTag["DW_TAG_variant_part"] = 51] = "DW_TAG_variant_part";
    DwarfTag[DwarfTag["DW_TAG_variable"] = 52] = "DW_TAG_variable";
    DwarfTag[DwarfTag["DW_TAG_volatile_type"] = 53] = "DW_TAG_volatile_type";
    // DWARF 3.
    DwarfTag[DwarfTag["DW_TAG_dwarf_procedure"] = 54] = "DW_TAG_dwarf_procedure";
    DwarfTag[DwarfTag["DW_TAG_restrict_type"] = 55] = "DW_TAG_restrict_type";
    DwarfTag[DwarfTag["DW_TAG_interface_type"] = 56] = "DW_TAG_interface_type";
    DwarfTag[DwarfTag["DW_TAG_namespace"] = 57] = "DW_TAG_namespace";
    DwarfTag[DwarfTag["DW_TAG_imported_module"] = 58] = "DW_TAG_imported_module";
    DwarfTag[DwarfTag["DW_TAG_unspecified_type"] = 59] = "DW_TAG_unspecified_type";
    DwarfTag[DwarfTag["DW_TAG_partial_unit"] = 60] = "DW_TAG_partial_unit";
    DwarfTag[DwarfTag["DW_TAG_imported_unit"] = 61] = "DW_TAG_imported_unit";
    // SGI/MIPS Extensions.
    DwarfTag[DwarfTag["DW_TAG_MIPS_loop"] = 16513] = "DW_TAG_MIPS_loop";
    // HP extensions.  See:
    // ftp://ftp.hp.com/pub/lang/tools/WDB/wdb-4.0.tar.gz
    DwarfTag[DwarfTag["DW_TAG_HP_array_descriptor"] = 16528] = "DW_TAG_HP_array_descriptor";
    // GNU extensions.
    DwarfTag[DwarfTag["DW_TAG_format_label"] = 16641] = "DW_TAG_format_label";
    DwarfTag[DwarfTag["DW_TAG_function_template"] = 16642] = "DW_TAG_function_template";
    DwarfTag[DwarfTag["DW_TAG_class_template"] = 16643] = "DW_TAG_class_template";
    DwarfTag[DwarfTag["DW_TAG_GNU_BINCL"] = 16644] = "DW_TAG_GNU_BINCL";
    DwarfTag[DwarfTag["DW_TAG_GNU_EINCL"] = 16645] = "DW_TAG_GNU_EINCL";
    // Extensions for UPC.  See: http://upc.gwu.edu/~upc.
    DwarfTag[DwarfTag["DW_TAG_upc_shared_type"] = 34661] = "DW_TAG_upc_shared_type";
    DwarfTag[DwarfTag["DW_TAG_upc_strict_type"] = 34662] = "DW_TAG_upc_strict_type";
    DwarfTag[DwarfTag["DW_TAG_upc_relaxed_type"] = 34663] = "DW_TAG_upc_relaxed_type";
    // PGI (STMicroelectronics) extensions.  No documentation available.
    DwarfTag[DwarfTag["DW_TAG_PGI_kanji_type"] = 40960] = "DW_TAG_PGI_kanji_type";
    DwarfTag[DwarfTag["DW_TAG_PGI_interface_block"] = 40992] = "DW_TAG_PGI_interface_block";
})(DwarfTag || (DwarfTag = {}));
;
var DwarfHasChild;
(function (DwarfHasChild) {
    DwarfHasChild[DwarfHasChild["DW_children_no"] = 0] = "DW_children_no";
    DwarfHasChild[DwarfHasChild["DW_children_yes"] = 1] = "DW_children_yes";
})(DwarfHasChild || (DwarfHasChild = {}));
;
// Form names and codes.
var DwarfForm;
(function (DwarfForm) {
    DwarfForm[DwarfForm["DW_FORM_addr"] = 1] = "DW_FORM_addr";
    DwarfForm[DwarfForm["DW_FORM_block2"] = 3] = "DW_FORM_block2";
    DwarfForm[DwarfForm["DW_FORM_block4"] = 4] = "DW_FORM_block4";
    DwarfForm[DwarfForm["DW_FORM_data2"] = 5] = "DW_FORM_data2";
    DwarfForm[DwarfForm["DW_FORM_data4"] = 6] = "DW_FORM_data4";
    DwarfForm[DwarfForm["DW_FORM_data8"] = 7] = "DW_FORM_data8";
    DwarfForm[DwarfForm["DW_FORM_string"] = 8] = "DW_FORM_string";
    DwarfForm[DwarfForm["DW_FORM_block"] = 9] = "DW_FORM_block";
    DwarfForm[DwarfForm["DW_FORM_block1"] = 10] = "DW_FORM_block1";
    DwarfForm[DwarfForm["DW_FORM_data1"] = 11] = "DW_FORM_data1";
    DwarfForm[DwarfForm["DW_FORM_flag"] = 12] = "DW_FORM_flag";
    DwarfForm[DwarfForm["DW_FORM_sdata"] = 13] = "DW_FORM_sdata";
    DwarfForm[DwarfForm["DW_FORM_strp"] = 14] = "DW_FORM_strp";
    DwarfForm[DwarfForm["DW_FORM_udata"] = 15] = "DW_FORM_udata";
    DwarfForm[DwarfForm["DW_FORM_ref_addr"] = 16] = "DW_FORM_ref_addr";
    DwarfForm[DwarfForm["DW_FORM_ref1"] = 17] = "DW_FORM_ref1";
    DwarfForm[DwarfForm["DW_FORM_ref2"] = 18] = "DW_FORM_ref2";
    DwarfForm[DwarfForm["DW_FORM_ref4"] = 19] = "DW_FORM_ref4";
    DwarfForm[DwarfForm["DW_FORM_ref8"] = 20] = "DW_FORM_ref8";
    DwarfForm[DwarfForm["DW_FORM_ref_udata"] = 21] = "DW_FORM_ref_udata";
    DwarfForm[DwarfForm["DW_FORM_indirect"] = 22] = "DW_FORM_indirect";
})(DwarfForm || (DwarfForm = {}));
;
// Attribute names and codes
var DwarfAttribute;
(function (DwarfAttribute) {
    DwarfAttribute[DwarfAttribute["DW_AT_sibling"] = 1] = "DW_AT_sibling";
    DwarfAttribute[DwarfAttribute["DW_AT_location"] = 2] = "DW_AT_location";
    DwarfAttribute[DwarfAttribute["DW_AT_name"] = 3] = "DW_AT_name";
    DwarfAttribute[DwarfAttribute["DW_AT_ordering"] = 9] = "DW_AT_ordering";
    DwarfAttribute[DwarfAttribute["DW_AT_subscr_data"] = 10] = "DW_AT_subscr_data";
    DwarfAttribute[DwarfAttribute["DW_AT_byte_size"] = 11] = "DW_AT_byte_size";
    DwarfAttribute[DwarfAttribute["DW_AT_bit_offset"] = 12] = "DW_AT_bit_offset";
    DwarfAttribute[DwarfAttribute["DW_AT_bit_size"] = 13] = "DW_AT_bit_size";
    DwarfAttribute[DwarfAttribute["DW_AT_element_list"] = 15] = "DW_AT_element_list";
    DwarfAttribute[DwarfAttribute["DW_AT_stmt_list"] = 16] = "DW_AT_stmt_list";
    DwarfAttribute[DwarfAttribute["DW_AT_low_pc"] = 17] = "DW_AT_low_pc";
    DwarfAttribute[DwarfAttribute["DW_AT_high_pc"] = 18] = "DW_AT_high_pc";
    DwarfAttribute[DwarfAttribute["DW_AT_language"] = 19] = "DW_AT_language";
    DwarfAttribute[DwarfAttribute["DW_AT_member"] = 20] = "DW_AT_member";
    DwarfAttribute[DwarfAttribute["DW_AT_discr"] = 21] = "DW_AT_discr";
    DwarfAttribute[DwarfAttribute["DW_AT_discr_value"] = 22] = "DW_AT_discr_value";
    DwarfAttribute[DwarfAttribute["DW_AT_visibility"] = 23] = "DW_AT_visibility";
    DwarfAttribute[DwarfAttribute["DW_AT_import"] = 24] = "DW_AT_import";
    DwarfAttribute[DwarfAttribute["DW_AT_string_length"] = 25] = "DW_AT_string_length";
    DwarfAttribute[DwarfAttribute["DW_AT_common_reference"] = 26] = "DW_AT_common_reference";
    DwarfAttribute[DwarfAttribute["DW_AT_comp_dir"] = 27] = "DW_AT_comp_dir";
    DwarfAttribute[DwarfAttribute["DW_AT_const_value"] = 28] = "DW_AT_const_value";
    DwarfAttribute[DwarfAttribute["DW_AT_containing_type"] = 29] = "DW_AT_containing_type";
    DwarfAttribute[DwarfAttribute["DW_AT_default_value"] = 30] = "DW_AT_default_value";
    DwarfAttribute[DwarfAttribute["DW_AT_inline"] = 32] = "DW_AT_inline";
    DwarfAttribute[DwarfAttribute["DW_AT_is_optional"] = 33] = "DW_AT_is_optional";
    DwarfAttribute[DwarfAttribute["DW_AT_lower_bound"] = 34] = "DW_AT_lower_bound";
    DwarfAttribute[DwarfAttribute["DW_AT_producer"] = 37] = "DW_AT_producer";
    DwarfAttribute[DwarfAttribute["DW_AT_prototyped"] = 39] = "DW_AT_prototyped";
    DwarfAttribute[DwarfAttribute["DW_AT_return_addr"] = 42] = "DW_AT_return_addr";
    DwarfAttribute[DwarfAttribute["DW_AT_start_scope"] = 44] = "DW_AT_start_scope";
    DwarfAttribute[DwarfAttribute["DW_AT_stride_size"] = 46] = "DW_AT_stride_size";
    DwarfAttribute[DwarfAttribute["DW_AT_upper_bound"] = 47] = "DW_AT_upper_bound";
    DwarfAttribute[DwarfAttribute["DW_AT_abstract_origin"] = 49] = "DW_AT_abstract_origin";
    DwarfAttribute[DwarfAttribute["DW_AT_accessibility"] = 50] = "DW_AT_accessibility";
    DwarfAttribute[DwarfAttribute["DW_AT_address_class"] = 51] = "DW_AT_address_class";
    DwarfAttribute[DwarfAttribute["DW_AT_artificial"] = 52] = "DW_AT_artificial";
    DwarfAttribute[DwarfAttribute["DW_AT_base_types"] = 53] = "DW_AT_base_types";
    DwarfAttribute[DwarfAttribute["DW_AT_calling_convention"] = 54] = "DW_AT_calling_convention";
    DwarfAttribute[DwarfAttribute["DW_AT_count"] = 55] = "DW_AT_count";
    DwarfAttribute[DwarfAttribute["DW_AT_data_member_location"] = 56] = "DW_AT_data_member_location";
    DwarfAttribute[DwarfAttribute["DW_AT_decl_column"] = 57] = "DW_AT_decl_column";
    DwarfAttribute[DwarfAttribute["DW_AT_decl_file"] = 58] = "DW_AT_decl_file";
    DwarfAttribute[DwarfAttribute["DW_AT_decl_line"] = 59] = "DW_AT_decl_line";
    DwarfAttribute[DwarfAttribute["DW_AT_declaration"] = 60] = "DW_AT_declaration";
    DwarfAttribute[DwarfAttribute["DW_AT_discr_list"] = 61] = "DW_AT_discr_list";
    DwarfAttribute[DwarfAttribute["DW_AT_encoding"] = 62] = "DW_AT_encoding";
    DwarfAttribute[DwarfAttribute["DW_AT_external"] = 63] = "DW_AT_external";
    DwarfAttribute[DwarfAttribute["DW_AT_frame_base"] = 64] = "DW_AT_frame_base";
    DwarfAttribute[DwarfAttribute["DW_AT_friend"] = 65] = "DW_AT_friend";
    DwarfAttribute[DwarfAttribute["DW_AT_identifier_case"] = 66] = "DW_AT_identifier_case";
    DwarfAttribute[DwarfAttribute["DW_AT_macro_info"] = 67] = "DW_AT_macro_info";
    DwarfAttribute[DwarfAttribute["DW_AT_namelist_items"] = 68] = "DW_AT_namelist_items";
    DwarfAttribute[DwarfAttribute["DW_AT_priority"] = 69] = "DW_AT_priority";
    DwarfAttribute[DwarfAttribute["DW_AT_segment"] = 70] = "DW_AT_segment";
    DwarfAttribute[DwarfAttribute["DW_AT_specification"] = 71] = "DW_AT_specification";
    DwarfAttribute[DwarfAttribute["DW_AT_static_link"] = 72] = "DW_AT_static_link";
    DwarfAttribute[DwarfAttribute["DW_AT_type"] = 73] = "DW_AT_type";
    DwarfAttribute[DwarfAttribute["DW_AT_use_location"] = 74] = "DW_AT_use_location";
    DwarfAttribute[DwarfAttribute["DW_AT_variable_parameter"] = 75] = "DW_AT_variable_parameter";
    DwarfAttribute[DwarfAttribute["DW_AT_virtuality"] = 76] = "DW_AT_virtuality";
    DwarfAttribute[DwarfAttribute["DW_AT_vtable_elem_location"] = 77] = "DW_AT_vtable_elem_location";
    // DWARF 3 values.
    DwarfAttribute[DwarfAttribute["DW_AT_allocated"] = 78] = "DW_AT_allocated";
    DwarfAttribute[DwarfAttribute["DW_AT_associated"] = 79] = "DW_AT_associated";
    DwarfAttribute[DwarfAttribute["DW_AT_data_location"] = 80] = "DW_AT_data_location";
    DwarfAttribute[DwarfAttribute["DW_AT_stride"] = 81] = "DW_AT_stride";
    DwarfAttribute[DwarfAttribute["DW_AT_entry_pc"] = 82] = "DW_AT_entry_pc";
    DwarfAttribute[DwarfAttribute["DW_AT_use_UTF8"] = 83] = "DW_AT_use_UTF8";
    DwarfAttribute[DwarfAttribute["DW_AT_extension"] = 84] = "DW_AT_extension";
    DwarfAttribute[DwarfAttribute["DW_AT_ranges"] = 85] = "DW_AT_ranges";
    DwarfAttribute[DwarfAttribute["DW_AT_trampoline"] = 86] = "DW_AT_trampoline";
    DwarfAttribute[DwarfAttribute["DW_AT_call_column"] = 87] = "DW_AT_call_column";
    DwarfAttribute[DwarfAttribute["DW_AT_call_file"] = 88] = "DW_AT_call_file";
    DwarfAttribute[DwarfAttribute["DW_AT_call_line"] = 89] = "DW_AT_call_line";
    // SGI/MIPS extensions.
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_fde"] = 8193] = "DW_AT_MIPS_fde";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_loop_begin"] = 8194] = "DW_AT_MIPS_loop_begin";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_tail_loop_begin"] = 8195] = "DW_AT_MIPS_tail_loop_begin";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_epilog_begin"] = 8196] = "DW_AT_MIPS_epilog_begin";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_loop_unroll_factor"] = 8197] = "DW_AT_MIPS_loop_unroll_factor";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_software_pipeline_depth"] = 8198] = "DW_AT_MIPS_software_pipeline_depth";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_linkage_name"] = 8199] = "DW_AT_MIPS_linkage_name";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_stride"] = 8200] = "DW_AT_MIPS_stride";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_abstract_name"] = 8201] = "DW_AT_MIPS_abstract_name";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_clone_origin"] = 8202] = "DW_AT_MIPS_clone_origin";
    DwarfAttribute[DwarfAttribute["DW_AT_MIPS_has_inlines"] = 8203] = "DW_AT_MIPS_has_inlines";
    // HP extensions.
    DwarfAttribute[DwarfAttribute["DW_AT_HP_block_index"] = 8192] = "DW_AT_HP_block_index";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_unmodifiable"] = 8193] = "DW_AT_HP_unmodifiable";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_actuals_stmt_list"] = 8208] = "DW_AT_HP_actuals_stmt_list";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_proc_per_section"] = 8209] = "DW_AT_HP_proc_per_section";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_raw_data_ptr"] = 8210] = "DW_AT_HP_raw_data_ptr";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_pass_by_reference"] = 8211] = "DW_AT_HP_pass_by_reference";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_opt_level"] = 8212] = "DW_AT_HP_opt_level";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_prof_version_id"] = 8213] = "DW_AT_HP_prof_version_id";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_opt_flags"] = 8214] = "DW_AT_HP_opt_flags";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_cold_region_low_pc"] = 8215] = "DW_AT_HP_cold_region_low_pc";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_cold_region_high_pc"] = 8216] = "DW_AT_HP_cold_region_high_pc";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_all_variables_modifiable"] = 8217] = "DW_AT_HP_all_variables_modifiable";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_linkage_name"] = 8218] = "DW_AT_HP_linkage_name";
    DwarfAttribute[DwarfAttribute["DW_AT_HP_prof_flags"] = 8219] = "DW_AT_HP_prof_flags";
    // GNU extensions.
    DwarfAttribute[DwarfAttribute["DW_AT_sf_names"] = 8449] = "DW_AT_sf_names";
    DwarfAttribute[DwarfAttribute["DW_AT_src_info"] = 8450] = "DW_AT_src_info";
    DwarfAttribute[DwarfAttribute["DW_AT_mac_info"] = 8451] = "DW_AT_mac_info";
    DwarfAttribute[DwarfAttribute["DW_AT_src_coords"] = 8452] = "DW_AT_src_coords";
    DwarfAttribute[DwarfAttribute["DW_AT_body_begin"] = 8453] = "DW_AT_body_begin";
    DwarfAttribute[DwarfAttribute["DW_AT_body_end"] = 8454] = "DW_AT_body_end";
    DwarfAttribute[DwarfAttribute["DW_AT_GNU_vector"] = 8455] = "DW_AT_GNU_vector";
    // VMS extensions.
    DwarfAttribute[DwarfAttribute["DW_AT_VMS_rtnbeg_pd_address"] = 8705] = "DW_AT_VMS_rtnbeg_pd_address";
    // UPC extension.
    DwarfAttribute[DwarfAttribute["DW_AT_upc_threads_scaled"] = 12816] = "DW_AT_upc_threads_scaled";
    // PGI (STMicroelectronics) extensions.
    DwarfAttribute[DwarfAttribute["DW_AT_PGI_lbase"] = 14848] = "DW_AT_PGI_lbase";
    DwarfAttribute[DwarfAttribute["DW_AT_PGI_soffset"] = 14849] = "DW_AT_PGI_soffset";
    DwarfAttribute[DwarfAttribute["DW_AT_PGI_lstride"] = 14850] = "DW_AT_PGI_lstride";
})(DwarfAttribute || (DwarfAttribute = {}));
;
// Line number opcodes.
var DwarfLineNumberOps;
(function (DwarfLineNumberOps) {
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_extended_op"] = 0] = "DW_LNS_extended_op";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_copy"] = 1] = "DW_LNS_copy";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_advance_pc"] = 2] = "DW_LNS_advance_pc";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_advance_line"] = 3] = "DW_LNS_advance_line";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_set_file"] = 4] = "DW_LNS_set_file";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_set_column"] = 5] = "DW_LNS_set_column";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_negate_stmt"] = 6] = "DW_LNS_negate_stmt";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_set_basic_block"] = 7] = "DW_LNS_set_basic_block";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_const_add_pc"] = 8] = "DW_LNS_const_add_pc";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_fixed_advance_pc"] = 9] = "DW_LNS_fixed_advance_pc";
    // DWARF 3.
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_set_prologue_end"] = 10] = "DW_LNS_set_prologue_end";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_set_epilogue_begin"] = 11] = "DW_LNS_set_epilogue_begin";
    DwarfLineNumberOps[DwarfLineNumberOps["DW_LNS_set_isa"] = 12] = "DW_LNS_set_isa";
})(DwarfLineNumberOps || (DwarfLineNumberOps = {}));
;
// Line number extended opcodes.
var DwarfLineNumberExtendedOps;
(function (DwarfLineNumberExtendedOps) {
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_end_sequence"] = 1] = "DW_LNE_end_sequence";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_set_address"] = 2] = "DW_LNE_set_address";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_define_file"] = 3] = "DW_LNE_define_file";
    // HP extensions.
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_negate_is_UV_update"] = 17] = "DW_LNE_HP_negate_is_UV_update";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_push_context"] = 18] = "DW_LNE_HP_push_context";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_pop_context"] = 19] = "DW_LNE_HP_pop_context";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_set_file_line_column"] = 20] = "DW_LNE_HP_set_file_line_column";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_set_routine_name"] = 21] = "DW_LNE_HP_set_routine_name";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_set_sequence"] = 22] = "DW_LNE_HP_set_sequence";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_negate_post_semantics"] = 23] = "DW_LNE_HP_negate_post_semantics";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_negate_function_exit"] = 24] = "DW_LNE_HP_negate_function_exit";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_negate_front_end_logical"] = 25] = "DW_LNE_HP_negate_front_end_logical";
    DwarfLineNumberExtendedOps[DwarfLineNumberExtendedOps["DW_LNE_HP_define_proc"] = 32] = "DW_LNE_HP_define_proc";
})(DwarfLineNumberExtendedOps || (DwarfLineNumberExtendedOps = {}));
;
// Type encoding names and codes
var DwarfEncoding;
(function (DwarfEncoding) {
    DwarfEncoding[DwarfEncoding["DW_ATE_address"] = 1] = "DW_ATE_address";
    DwarfEncoding[DwarfEncoding["DW_ATE_boolean"] = 2] = "DW_ATE_boolean";
    DwarfEncoding[DwarfEncoding["DW_ATE_complex_float"] = 3] = "DW_ATE_complex_float";
    DwarfEncoding[DwarfEncoding["DW_ATE_float"] = 4] = "DW_ATE_float";
    DwarfEncoding[DwarfEncoding["DW_ATE_signed"] = 5] = "DW_ATE_signed";
    DwarfEncoding[DwarfEncoding["DW_ATE_signed_char"] = 6] = "DW_ATE_signed_char";
    DwarfEncoding[DwarfEncoding["DW_ATE_unsigned"] = 7] = "DW_ATE_unsigned";
    DwarfEncoding[DwarfEncoding["DW_ATE_unsigned_char"] = 8] = "DW_ATE_unsigned_char";
    // DWARF3/DWARF3f
    DwarfEncoding[DwarfEncoding["DW_ATE_imaginary_float"] = 9] = "DW_ATE_imaginary_float";
    DwarfEncoding[DwarfEncoding["DW_ATE_packed_decimal"] = 10] = "DW_ATE_packed_decimal";
    DwarfEncoding[DwarfEncoding["DW_ATE_numeric_string"] = 11] = "DW_ATE_numeric_string";
    DwarfEncoding[DwarfEncoding["DW_ATE_edited"] = 12] = "DW_ATE_edited";
    DwarfEncoding[DwarfEncoding["DW_ATE_signed_fixed"] = 13] = "DW_ATE_signed_fixed";
    DwarfEncoding[DwarfEncoding["DW_ATE_unsigned_fixed"] = 14] = "DW_ATE_unsigned_fixed";
    DwarfEncoding[DwarfEncoding["DW_ATE_decimal_float"] = 15] = "DW_ATE_decimal_float";
    DwarfEncoding[DwarfEncoding["DW_ATE_lo_user"] = 128] = "DW_ATE_lo_user";
    DwarfEncoding[DwarfEncoding["DW_ATE_hi_user"] = 255] = "DW_ATE_hi_user";
})(DwarfEncoding || (DwarfEncoding = {}));
;
// Location virtual machine opcodes
var DwarfOpcode;
(function (DwarfOpcode) {
    DwarfOpcode[DwarfOpcode["DW_OP_addr"] = 3] = "DW_OP_addr";
    DwarfOpcode[DwarfOpcode["DW_OP_deref"] = 6] = "DW_OP_deref";
    DwarfOpcode[DwarfOpcode["DW_OP_const1u"] = 8] = "DW_OP_const1u";
    DwarfOpcode[DwarfOpcode["DW_OP_const1s"] = 9] = "DW_OP_const1s";
    DwarfOpcode[DwarfOpcode["DW_OP_const2u"] = 10] = "DW_OP_const2u";
    DwarfOpcode[DwarfOpcode["DW_OP_const2s"] = 11] = "DW_OP_const2s";
    DwarfOpcode[DwarfOpcode["DW_OP_const4u"] = 12] = "DW_OP_const4u";
    DwarfOpcode[DwarfOpcode["DW_OP_const4s"] = 13] = "DW_OP_const4s";
    DwarfOpcode[DwarfOpcode["DW_OP_const8u"] = 14] = "DW_OP_const8u";
    DwarfOpcode[DwarfOpcode["DW_OP_const8s"] = 15] = "DW_OP_const8s";
    DwarfOpcode[DwarfOpcode["DW_OP_constu"] = 16] = "DW_OP_constu";
    DwarfOpcode[DwarfOpcode["DW_OP_consts"] = 17] = "DW_OP_consts";
    DwarfOpcode[DwarfOpcode["DW_OP_dup"] = 18] = "DW_OP_dup";
    DwarfOpcode[DwarfOpcode["DW_OP_drop"] = 19] = "DW_OP_drop";
    DwarfOpcode[DwarfOpcode["DW_OP_over"] = 20] = "DW_OP_over";
    DwarfOpcode[DwarfOpcode["DW_OP_pick"] = 21] = "DW_OP_pick";
    DwarfOpcode[DwarfOpcode["DW_OP_swap"] = 22] = "DW_OP_swap";
    DwarfOpcode[DwarfOpcode["DW_OP_rot"] = 23] = "DW_OP_rot";
    DwarfOpcode[DwarfOpcode["DW_OP_xderef"] = 24] = "DW_OP_xderef";
    DwarfOpcode[DwarfOpcode["DW_OP_abs"] = 25] = "DW_OP_abs";
    DwarfOpcode[DwarfOpcode["DW_OP_and"] = 26] = "DW_OP_and";
    DwarfOpcode[DwarfOpcode["DW_OP_div"] = 27] = "DW_OP_div";
    DwarfOpcode[DwarfOpcode["DW_OP_minus"] = 28] = "DW_OP_minus";
    DwarfOpcode[DwarfOpcode["DW_OP_mod"] = 29] = "DW_OP_mod";
    DwarfOpcode[DwarfOpcode["DW_OP_mul"] = 30] = "DW_OP_mul";
    DwarfOpcode[DwarfOpcode["DW_OP_neg"] = 31] = "DW_OP_neg";
    DwarfOpcode[DwarfOpcode["DW_OP_not"] = 32] = "DW_OP_not";
    DwarfOpcode[DwarfOpcode["DW_OP_or"] = 33] = "DW_OP_or";
    DwarfOpcode[DwarfOpcode["DW_OP_plus"] = 34] = "DW_OP_plus";
    DwarfOpcode[DwarfOpcode["DW_OP_plus_uconst"] = 35] = "DW_OP_plus_uconst";
    DwarfOpcode[DwarfOpcode["DW_OP_shl"] = 36] = "DW_OP_shl";
    DwarfOpcode[DwarfOpcode["DW_OP_shr"] = 37] = "DW_OP_shr";
    DwarfOpcode[DwarfOpcode["DW_OP_shra"] = 38] = "DW_OP_shra";
    DwarfOpcode[DwarfOpcode["DW_OP_xor"] = 39] = "DW_OP_xor";
    DwarfOpcode[DwarfOpcode["DW_OP_bra"] = 40] = "DW_OP_bra";
    DwarfOpcode[DwarfOpcode["DW_OP_eq"] = 41] = "DW_OP_eq";
    DwarfOpcode[DwarfOpcode["DW_OP_ge"] = 42] = "DW_OP_ge";
    DwarfOpcode[DwarfOpcode["DW_OP_gt"] = 43] = "DW_OP_gt";
    DwarfOpcode[DwarfOpcode["DW_OP_le"] = 44] = "DW_OP_le";
    DwarfOpcode[DwarfOpcode["DW_OP_lt"] = 45] = "DW_OP_lt";
    DwarfOpcode[DwarfOpcode["DW_OP_ne"] = 46] = "DW_OP_ne";
    DwarfOpcode[DwarfOpcode["DW_OP_skip"] = 47] = "DW_OP_skip";
    DwarfOpcode[DwarfOpcode["DW_OP_lit0"] = 48] = "DW_OP_lit0";
    DwarfOpcode[DwarfOpcode["DW_OP_lit1"] = 49] = "DW_OP_lit1";
    DwarfOpcode[DwarfOpcode["DW_OP_lit2"] = 50] = "DW_OP_lit2";
    DwarfOpcode[DwarfOpcode["DW_OP_lit3"] = 51] = "DW_OP_lit3";
    DwarfOpcode[DwarfOpcode["DW_OP_lit4"] = 52] = "DW_OP_lit4";
    DwarfOpcode[DwarfOpcode["DW_OP_lit5"] = 53] = "DW_OP_lit5";
    DwarfOpcode[DwarfOpcode["DW_OP_lit6"] = 54] = "DW_OP_lit6";
    DwarfOpcode[DwarfOpcode["DW_OP_lit7"] = 55] = "DW_OP_lit7";
    DwarfOpcode[DwarfOpcode["DW_OP_lit8"] = 56] = "DW_OP_lit8";
    DwarfOpcode[DwarfOpcode["DW_OP_lit9"] = 57] = "DW_OP_lit9";
    DwarfOpcode[DwarfOpcode["DW_OP_lit10"] = 58] = "DW_OP_lit10";
    DwarfOpcode[DwarfOpcode["DW_OP_lit11"] = 59] = "DW_OP_lit11";
    DwarfOpcode[DwarfOpcode["DW_OP_lit12"] = 60] = "DW_OP_lit12";
    DwarfOpcode[DwarfOpcode["DW_OP_lit13"] = 61] = "DW_OP_lit13";
    DwarfOpcode[DwarfOpcode["DW_OP_lit14"] = 62] = "DW_OP_lit14";
    DwarfOpcode[DwarfOpcode["DW_OP_lit15"] = 63] = "DW_OP_lit15";
    DwarfOpcode[DwarfOpcode["DW_OP_lit16"] = 64] = "DW_OP_lit16";
    DwarfOpcode[DwarfOpcode["DW_OP_lit17"] = 65] = "DW_OP_lit17";
    DwarfOpcode[DwarfOpcode["DW_OP_lit18"] = 66] = "DW_OP_lit18";
    DwarfOpcode[DwarfOpcode["DW_OP_lit19"] = 67] = "DW_OP_lit19";
    DwarfOpcode[DwarfOpcode["DW_OP_lit20"] = 68] = "DW_OP_lit20";
    DwarfOpcode[DwarfOpcode["DW_OP_lit21"] = 69] = "DW_OP_lit21";
    DwarfOpcode[DwarfOpcode["DW_OP_lit22"] = 70] = "DW_OP_lit22";
    DwarfOpcode[DwarfOpcode["DW_OP_lit23"] = 71] = "DW_OP_lit23";
    DwarfOpcode[DwarfOpcode["DW_OP_lit24"] = 72] = "DW_OP_lit24";
    DwarfOpcode[DwarfOpcode["DW_OP_lit25"] = 73] = "DW_OP_lit25";
    DwarfOpcode[DwarfOpcode["DW_OP_lit26"] = 74] = "DW_OP_lit26";
    DwarfOpcode[DwarfOpcode["DW_OP_lit27"] = 75] = "DW_OP_lit27";
    DwarfOpcode[DwarfOpcode["DW_OP_lit28"] = 76] = "DW_OP_lit28";
    DwarfOpcode[DwarfOpcode["DW_OP_lit29"] = 77] = "DW_OP_lit29";
    DwarfOpcode[DwarfOpcode["DW_OP_lit30"] = 78] = "DW_OP_lit30";
    DwarfOpcode[DwarfOpcode["DW_OP_lit31"] = 79] = "DW_OP_lit31";
    DwarfOpcode[DwarfOpcode["DW_OP_reg0"] = 80] = "DW_OP_reg0";
    DwarfOpcode[DwarfOpcode["DW_OP_reg1"] = 81] = "DW_OP_reg1";
    DwarfOpcode[DwarfOpcode["DW_OP_reg2"] = 82] = "DW_OP_reg2";
    DwarfOpcode[DwarfOpcode["DW_OP_reg3"] = 83] = "DW_OP_reg3";
    DwarfOpcode[DwarfOpcode["DW_OP_reg4"] = 84] = "DW_OP_reg4";
    DwarfOpcode[DwarfOpcode["DW_OP_reg5"] = 85] = "DW_OP_reg5";
    DwarfOpcode[DwarfOpcode["DW_OP_reg6"] = 86] = "DW_OP_reg6";
    DwarfOpcode[DwarfOpcode["DW_OP_reg7"] = 87] = "DW_OP_reg7";
    DwarfOpcode[DwarfOpcode["DW_OP_reg8"] = 88] = "DW_OP_reg8";
    DwarfOpcode[DwarfOpcode["DW_OP_reg9"] = 89] = "DW_OP_reg9";
    DwarfOpcode[DwarfOpcode["DW_OP_reg10"] = 90] = "DW_OP_reg10";
    DwarfOpcode[DwarfOpcode["DW_OP_reg11"] = 91] = "DW_OP_reg11";
    DwarfOpcode[DwarfOpcode["DW_OP_reg12"] = 92] = "DW_OP_reg12";
    DwarfOpcode[DwarfOpcode["DW_OP_reg13"] = 93] = "DW_OP_reg13";
    DwarfOpcode[DwarfOpcode["DW_OP_reg14"] = 94] = "DW_OP_reg14";
    DwarfOpcode[DwarfOpcode["DW_OP_reg15"] = 95] = "DW_OP_reg15";
    DwarfOpcode[DwarfOpcode["DW_OP_reg16"] = 96] = "DW_OP_reg16";
    DwarfOpcode[DwarfOpcode["DW_OP_reg17"] = 97] = "DW_OP_reg17";
    DwarfOpcode[DwarfOpcode["DW_OP_reg18"] = 98] = "DW_OP_reg18";
    DwarfOpcode[DwarfOpcode["DW_OP_reg19"] = 99] = "DW_OP_reg19";
    DwarfOpcode[DwarfOpcode["DW_OP_reg20"] = 100] = "DW_OP_reg20";
    DwarfOpcode[DwarfOpcode["DW_OP_reg21"] = 101] = "DW_OP_reg21";
    DwarfOpcode[DwarfOpcode["DW_OP_reg22"] = 102] = "DW_OP_reg22";
    DwarfOpcode[DwarfOpcode["DW_OP_reg23"] = 103] = "DW_OP_reg23";
    DwarfOpcode[DwarfOpcode["DW_OP_reg24"] = 104] = "DW_OP_reg24";
    DwarfOpcode[DwarfOpcode["DW_OP_reg25"] = 105] = "DW_OP_reg25";
    DwarfOpcode[DwarfOpcode["DW_OP_reg26"] = 106] = "DW_OP_reg26";
    DwarfOpcode[DwarfOpcode["DW_OP_reg27"] = 107] = "DW_OP_reg27";
    DwarfOpcode[DwarfOpcode["DW_OP_reg28"] = 108] = "DW_OP_reg28";
    DwarfOpcode[DwarfOpcode["DW_OP_reg29"] = 109] = "DW_OP_reg29";
    DwarfOpcode[DwarfOpcode["DW_OP_reg30"] = 110] = "DW_OP_reg30";
    DwarfOpcode[DwarfOpcode["DW_OP_reg31"] = 111] = "DW_OP_reg31";
    DwarfOpcode[DwarfOpcode["DW_OP_breg0"] = 112] = "DW_OP_breg0";
    DwarfOpcode[DwarfOpcode["DW_OP_breg1"] = 113] = "DW_OP_breg1";
    DwarfOpcode[DwarfOpcode["DW_OP_breg2"] = 114] = "DW_OP_breg2";
    DwarfOpcode[DwarfOpcode["DW_OP_breg3"] = 115] = "DW_OP_breg3";
    DwarfOpcode[DwarfOpcode["DW_OP_breg4"] = 116] = "DW_OP_breg4";
    DwarfOpcode[DwarfOpcode["DW_OP_breg5"] = 117] = "DW_OP_breg5";
    DwarfOpcode[DwarfOpcode["DW_OP_breg6"] = 118] = "DW_OP_breg6";
    DwarfOpcode[DwarfOpcode["DW_OP_breg7"] = 119] = "DW_OP_breg7";
    DwarfOpcode[DwarfOpcode["DW_OP_breg8"] = 120] = "DW_OP_breg8";
    DwarfOpcode[DwarfOpcode["DW_OP_breg9"] = 121] = "DW_OP_breg9";
    DwarfOpcode[DwarfOpcode["DW_OP_breg10"] = 122] = "DW_OP_breg10";
    DwarfOpcode[DwarfOpcode["DW_OP_breg11"] = 123] = "DW_OP_breg11";
    DwarfOpcode[DwarfOpcode["DW_OP_breg12"] = 124] = "DW_OP_breg12";
    DwarfOpcode[DwarfOpcode["DW_OP_breg13"] = 125] = "DW_OP_breg13";
    DwarfOpcode[DwarfOpcode["DW_OP_breg14"] = 126] = "DW_OP_breg14";
    DwarfOpcode[DwarfOpcode["DW_OP_breg15"] = 127] = "DW_OP_breg15";
    DwarfOpcode[DwarfOpcode["DW_OP_breg16"] = 128] = "DW_OP_breg16";
    DwarfOpcode[DwarfOpcode["DW_OP_breg17"] = 129] = "DW_OP_breg17";
    DwarfOpcode[DwarfOpcode["DW_OP_breg18"] = 130] = "DW_OP_breg18";
    DwarfOpcode[DwarfOpcode["DW_OP_breg19"] = 131] = "DW_OP_breg19";
    DwarfOpcode[DwarfOpcode["DW_OP_breg20"] = 132] = "DW_OP_breg20";
    DwarfOpcode[DwarfOpcode["DW_OP_breg21"] = 133] = "DW_OP_breg21";
    DwarfOpcode[DwarfOpcode["DW_OP_breg22"] = 134] = "DW_OP_breg22";
    DwarfOpcode[DwarfOpcode["DW_OP_breg23"] = 135] = "DW_OP_breg23";
    DwarfOpcode[DwarfOpcode["DW_OP_breg24"] = 136] = "DW_OP_breg24";
    DwarfOpcode[DwarfOpcode["DW_OP_breg25"] = 137] = "DW_OP_breg25";
    DwarfOpcode[DwarfOpcode["DW_OP_breg26"] = 138] = "DW_OP_breg26";
    DwarfOpcode[DwarfOpcode["DW_OP_breg27"] = 139] = "DW_OP_breg27";
    DwarfOpcode[DwarfOpcode["DW_OP_breg28"] = 140] = "DW_OP_breg28";
    DwarfOpcode[DwarfOpcode["DW_OP_breg29"] = 141] = "DW_OP_breg29";
    DwarfOpcode[DwarfOpcode["DW_OP_breg30"] = 142] = "DW_OP_breg30";
    DwarfOpcode[DwarfOpcode["DW_OP_breg31"] = 143] = "DW_OP_breg31";
    DwarfOpcode[DwarfOpcode["DW_OP_regX"] = 144] = "DW_OP_regX";
    DwarfOpcode[DwarfOpcode["DW_OP_fbreg"] = 145] = "DW_OP_fbreg";
    DwarfOpcode[DwarfOpcode["DW_OP_bregX"] = 146] = "DW_OP_bregX";
    DwarfOpcode[DwarfOpcode["DW_OP_piece"] = 147] = "DW_OP_piece";
    DwarfOpcode[DwarfOpcode["DW_OP_deref_size"] = 148] = "DW_OP_deref_size";
    DwarfOpcode[DwarfOpcode["DW_OP_xderef_size"] = 149] = "DW_OP_xderef_size";
    DwarfOpcode[DwarfOpcode["DW_OP_nop"] = 150] = "DW_OP_nop";
    // DWARF3/DWARF3f
    DwarfOpcode[DwarfOpcode["DW_OP_push_object_address"] = 151] = "DW_OP_push_object_address";
    DwarfOpcode[DwarfOpcode["DW_OP_call2"] = 152] = "DW_OP_call2";
    DwarfOpcode[DwarfOpcode["DW_OP_call4"] = 153] = "DW_OP_call4";
    DwarfOpcode[DwarfOpcode["DW_OP_call_ref"] = 154] = "DW_OP_call_ref";
    DwarfOpcode[DwarfOpcode["DW_OP_form_tls_address"] = 155] = "DW_OP_form_tls_address";
    DwarfOpcode[DwarfOpcode["DW_OP_call_frame_cfa"] = 156] = "DW_OP_call_frame_cfa";
    DwarfOpcode[DwarfOpcode["DW_OP_bit_piece"] = 157] = "DW_OP_bit_piece";
    DwarfOpcode[DwarfOpcode["DW_OP_lo_user"] = 224] = "DW_OP_lo_user";
    DwarfOpcode[DwarfOpcode["DW_OP_hi_user"] = 255] = "DW_OP_hi_user";
    // GNU extensions
    DwarfOpcode[DwarfOpcode["DW_OP_GNU_push_tls_address"] = 224] = "DW_OP_GNU_push_tls_address";
})(DwarfOpcode || (DwarfOpcode = {}));
;
// Source languages.  These are values for DW_AT_language.
var DwarfLanguage;
(function (DwarfLanguage) {
    DwarfLanguage[DwarfLanguage["DW_LANG_none"] = 0] = "DW_LANG_none";
    DwarfLanguage[DwarfLanguage["DW_LANG_C89"] = 1] = "DW_LANG_C89";
    DwarfLanguage[DwarfLanguage["DW_LANG_C"] = 2] = "DW_LANG_C";
    DwarfLanguage[DwarfLanguage["DW_LANG_Ada83"] = 3] = "DW_LANG_Ada83";
    DwarfLanguage[DwarfLanguage["DW_LANG_C_plus_plus"] = 4] = "DW_LANG_C_plus_plus";
    DwarfLanguage[DwarfLanguage["DW_LANG_Cobol74"] = 5] = "DW_LANG_Cobol74";
    DwarfLanguage[DwarfLanguage["DW_LANG_Cobol85"] = 6] = "DW_LANG_Cobol85";
    DwarfLanguage[DwarfLanguage["DW_LANG_Fortran77"] = 7] = "DW_LANG_Fortran77";
    DwarfLanguage[DwarfLanguage["DW_LANG_Fortran90"] = 8] = "DW_LANG_Fortran90";
    DwarfLanguage[DwarfLanguage["DW_LANG_Pascal83"] = 9] = "DW_LANG_Pascal83";
    DwarfLanguage[DwarfLanguage["DW_LANG_Modula2"] = 10] = "DW_LANG_Modula2";
    DwarfLanguage[DwarfLanguage["DW_LANG_Java"] = 11] = "DW_LANG_Java";
    DwarfLanguage[DwarfLanguage["DW_LANG_C99"] = 12] = "DW_LANG_C99";
    DwarfLanguage[DwarfLanguage["DW_LANG_Ada95"] = 13] = "DW_LANG_Ada95";
    DwarfLanguage[DwarfLanguage["DW_LANG_Fortran95"] = 14] = "DW_LANG_Fortran95";
    DwarfLanguage[DwarfLanguage["DW_LANG_PLI"] = 15] = "DW_LANG_PLI";
    DwarfLanguage[DwarfLanguage["DW_LANG_ObjC"] = 16] = "DW_LANG_ObjC";
    DwarfLanguage[DwarfLanguage["DW_LANG_ObjC_plus_plus"] = 17] = "DW_LANG_ObjC_plus_plus";
    DwarfLanguage[DwarfLanguage["DW_LANG_UPC"] = 18] = "DW_LANG_UPC";
    DwarfLanguage[DwarfLanguage["DW_LANG_D"] = 19] = "DW_LANG_D";
    // Implementation-defined language code range.
    DwarfLanguage[DwarfLanguage["DW_LANG_lo_user"] = 32768] = "DW_LANG_lo_user";
    DwarfLanguage[DwarfLanguage["DW_LANG_hi_user"] = 65535] = "DW_LANG_hi_user";
    // Extensions.
    // MIPS assembly language.  The GNU toolchain uses this for all
    // assembly languages, since there's no generic DW_LANG_ value for that.
    DwarfLanguage[DwarfLanguage["DW_LANG_Mips_Assembler"] = 32769] = "DW_LANG_Mips_Assembler";
    DwarfLanguage[DwarfLanguage["DW_LANG_Upc"] = 34661] = "DW_LANG_Upc"; // Unified Parallel C
})(DwarfLanguage || (DwarfLanguage = {}));
;
class ByteReader {
    constructor(view, littleEndian) {
        this.view = view;
        this.littleEndian = littleEndian;
        this.addressSize = 4;
        this.offsetSize = 4;
        this.offset = 0;
    }
    isEOF() {
        return this.offset >= this.view.byteLength;
    }
    readOneByte() {
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }
    readTwoBytes() {
        const value = this.view.getUint16(this.offset, this.littleEndian);
        this.offset += 2;
        return value;
    }
    readFourBytes() {
        const value = this.view.getUint32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }
    readEightBytes() {
        const value = this.view.getBigUint64(this.offset, this.littleEndian);
        this.offset += 8;
        return value;
    }
    readUnsignedLEB128() {
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
    readSignedLEB128() {
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
    readOffset() {
        if (this.offsetSize === 4) {
            const value = this.readFourBytes();
            return value;
            /*
        } else if (this.offsetSize === 8) {
            const value = this.readEightBytes();
            return value;
            */
        }
        else {
            throw new Error('Invalid offset size');
        }
    }
    readAddress() {
        if (this.addressSize === 4) {
            const value = this.readFourBytes();
            return value;
            /*
        } else if (this.addressSize === 8) {
            const value = this.readEightBytes();
            return value;
            */
        }
        else {
            throw new Error('Invalid address size');
        }
    }
    readInitialLength() {
        const initial_length = this.readFourBytes();
        // In DWARF2/3, if the initial length is all 1 bits, then the offset
        // size is 8 and we need to read the next 8 bytes for the real length.
        if (initial_length === 0xffffffff) {
            throw new Error('64-bit DWARF is not supported');
            //this.offsetSize = 8;
            //return this.readEightBytes();
        }
        else {
            this.offsetSize = 4;
            return initial_length;
        }
    }
    readString() {
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
    slice(offset, length) {
        return new DataView(this.view.buffer, this.view.byteOffset + offset, length);
    }
    readByteArray(length) {
        const result = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = this.readOneByte();
        }
        return result;
    }
}
class DWARFParser {
    constructor(elf) {
        this.elf = elf;
        this.units = [];
        this.lineInfos = [];
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
exports.DWARFParser = DWARFParser;
class DWARFCompilationUnit {
    constructor(infoReader, debugstrs) {
        this.infoReader = infoReader;
        this.debugstrs = debugstrs;
        this.abbrevs = [];
        const baseOffset = infoReader.offset;
        const length = infoReader.readInitialLength();
        const version = infoReader.readTwoBytes();
        this.abbrevOffset = Number(infoReader.readOffset());
        const address_size = infoReader.readOneByte();
        this.headerLength = infoReader.offset - baseOffset;
        if (version != 2)
            throw new Error('DWARF version ' + version + ' not supported');
        if (address_size !== 4)
            throw new Error('Address size ' + address_size + ' not supported');
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
    read(abbrev) {
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
    processDIEs(reader) {
        let die_stack = [{ children: [] }];
        // TODO: capture tree structure
        while (!reader.isEOF()) {
            let absolute_offset = reader.offset + this.contentOffset;
            let abbrev_num = Number(reader.readUnsignedLEB128());
            //console.log('DIE', absolute_offset.toString(16), abbrev_num);
            if (abbrev_num == 0) {
                let item = die_stack.pop();
                if (!item)
                    throw new Error('DIE stack underflow @ offset ' + reader.offset);
                continue;
            }
            let abbrev = this.abbrevs[abbrev_num - 1];
            if (!abbrev)
                throw new Error('Invalid abbreviation number ' + abbrev_num);
            let obj = this.processDIE(reader, abbrev);
            let top = die_stack[die_stack.length - 1];
            if (!top.children)
                top.children = [];
            top.children.push(obj);
            if (abbrev.has_children) {
                die_stack.push(obj);
            }
        }
        if (die_stack.length != 1)
            throw new Error('DIE stack not empty');
        return die_stack[0];
    }
    processDIE(reader, abbrev) {
        //console.log('processDIE', abbrev);
        let obj = { tag: DwarfTag[abbrev.tag] };
        // iterate through attributes
        for (let attr of abbrev.attributes) {
            let form = attr.form;
            let value = this.processAttribute(reader, form);
            obj[DwarfAttribute[attr.attr]] = value;
        }
        //console.log(obj);
        return obj;
    }
    processAttribute(reader, form) {
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
    getStringFrom(strtab, offset) {
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
class CompilationUnitHeader {
    constructor() {
        this.length = 0;
        this.version = 0;
        this.abbrev_offset = 0;
        this.address_size = 0;
    }
}
class LineStateMachine {
    constructor(default_is_stmt) {
        this.Reset(default_is_stmt);
    }
    Reset(default_is_stmt) {
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
function parseAbbrevs(reader) {
    const abbrevs = [];
    while (!reader.isEOF()) {
        const number = Number(reader.readUnsignedLEB128());
        if (number == 0)
            break;
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
        const abbrev = {
            number,
            tag: tag,
            has_children,
            attributes,
        };
        abbrevs.push(abbrev);
    }
    return abbrevs;
}
class DWARFLineInfo {
    constructor(headerReader) {
        this.headerReader = headerReader;
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
        if (version != 2)
            throw new Error('DWARF version ' + version + ' not supported');
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
            }
            else if (add_line) {
                let line = {
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
    processOneOpcode() {
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
//# sourceMappingURL=binutils.js.map
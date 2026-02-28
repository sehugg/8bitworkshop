// CodeMirror 6 language support for Inform6
// Migrated from CodeMirror 5 mode
// Original copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

import { StreamLanguage, StreamParser } from "@codemirror/language";
import { LanguageSupport } from "@codemirror/language";

interface Inform6State {
    context: number;
    tokenize: (stream: any, state: Inform6State) => string | null;
}

// TODO: Migrate to CodeMirror 6 Lezer parser.
function createInform6Parser(): StreamParser<Inform6State> {
    const keywords_list = "box|break|continue|do|else|fonton|fontoff|for|give|if|jump|new_line|objectloop|print|print_ret|remove|return|rfalse|rtrue|spaces|string|styleroman|stylebold|styleunderline|stylereverse|stylefixed|switch|until|while|has|hasnt|with|in|notin|ofclass|provides|or".split("|");
    const directives_list = "Abbreviate|Array|Attribute|Class|Constant|Default|End|Endif|Extend|Global|Ifdef|Ifndef|Ifnot|Iftrue|Iffalse|Import|Include|Link|Lowstring|Message|Object|Property|Release|Replace|Serial|Switches|Statuslinescore|Statuslinetime|System_file|Verb|Zcharacter".toLowerCase().split("|");
    const properties_list = "add_to_scope|after|article|articles|before|cant_go|capacity|d_to|daemon|describe|description|door_dir|door_to|e_to|each_turn|found_in|grammar|in_to|initial|inside_description|invent|life|list_together|name|n_to|ne_to|number|nw_to|orders|out_to|parse_name|plural|react_after|react_before|s_to|se_to|short_name|short_name_indef|sw_to|time_left|time_out|u_to|w_to|when_closed|when_open|when_on|when_off|with_key".split("|");
    const attributes_list = "absent|animate|clothing|concealed|container|door|edible|enterable|female|general|light|lockable|locked|male|moved|neuter|open|openable|pluralname|proper|scenery|scored|static|supporter|switchable|talkable|transparent|visited|workflag|worn".split("|");
    const actions_list = "Pronouns|Quit|Restart|Restore|Save|Verify|ScriptOn|ScriptOff|NotifyOn|NotifyOff|Places|Objects|Score|FullScore|Version|LMode1|LMode2|LMode3|Look|Examine|Search|Inv|InvTall|InvWide|Take|Drop|Remove|PutOn|Insert|LetGo|Receive|Empty|EmptyT|Remove|Transfer|Go|Enter|GetOff|GoIn|Exit|Unlock|Lock|SwitchOn|SwitchOff|Open|Close|Disrobe|Wear|Eat|Wait|LookUnder|Listen|Taste|Touch|Pull|Push|Wave|Turn|PushDir|ThrowAt|ThrownAt|JumpOver|Tie|Drink|Fill|Attack|Swing|Blow|Rub|Set|SetTo|Buy|Climb|Squeeze|Burn|Dig|Cut|Consult|Tell|Answer|Ask|Give|Show|AskFor|WakeOther|Kiss|Sleep|Sing|WaveHands|Swim|Sorry|Strong|Mild|Jump|Think|Smell|Pray|VagueGo|Yes|No|Wake|Answer|Ask|Attack|Give|Kiss|Order|Show|Tell|ThrowAt|WakeOther".toLowerCase().split("|");

    const directives = new Map<string, string>();
    directives_list.forEach(s => directives.set(s, 'keyword'));
    keywords_list.forEach(s => directives.set(s, 'keyword'));
    properties_list.forEach(s => directives.set(s, 'keyword'));
    attributes_list.forEach(s => directives.set(s, 'keyword'));
    actions_list.forEach(s => directives.set(s, 'keyword'));

    const numbers = /^([\da-f]+h|[0-7]+o|[01]+b|\d+d?)\b/i;

    function tokenBase(stream: any, state: Inform6State): string | null {
        if (stream.eatSpace())
            return null;

        let w;
        if (stream.eatWhile(/\w/)) {
            w = stream.current();
            const cur = w.toLowerCase();
            const style = directives.get(cur);
            if (style)
                return style;

            if (numbers.test(w)) {
                return 'number';
            } else if (stream.match(numbers)) {
                return 'number';
            } else {
                return null;
            }
        } else if (stream.eat('!')) {
            stream.skipToEnd();
            return 'comment';
        } else if (stream.match(/\]|\[|\}|\{/)) {
            return 'bracket';
        } else if (stream.match(/<<|>>/)) {
            return 'bracket';
        } else if (stream.match(/[#]+\w+/)) {
            return 'number';
        } else if (stream.eat('"')) {
            state.tokenize = tokenString;
            return tokenString(stream, state);
        } else if (stream.eat('\'')) {
            return tokenString2(stream, state);
        } else if (stream.eat('$')) {
            if (stream.eatWhile(/[^;]/i))
                return 'number';
        } else {
            stream.next();
        }
        return null;
    }

    function tokenString(stream: any, state: Inform6State): string | null {
        let ch;
        while (ch = stream.next()) {
            if (ch == '"') {
                state.tokenize = tokenBase;
                break;
            }
        }
        return "string";
    }

    function tokenString2(stream: any, state: Inform6State): string | null {
        let ch;
        while (ch = stream.next()) {
            if (ch == "'") {
                state.tokenize = tokenBase;
                break;
            }
        }
        return "meta";
    }

    return {
        startState(): Inform6State {
            return {
                context: 0,
                tokenize: tokenBase
            };
        },

        token(stream, state) {
            return state.tokenize(stream, state);
        }
    };
}

/**
 * Language support for Inform6
 */
export function inform6(): LanguageSupport {
    return new LanguageSupport(StreamLanguage.define(createInform6Parser()));
}

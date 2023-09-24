let emit = console.log;
let test = (name: string, callback: () => void) => callback();
//实现解析器的接口，T可以理解为AST
interface Parser<T> {
    //显式声明返回null，可激活严格null类型检查
    parse(source: Source): ParseResult<T> | null;
}
class ParseResult<T> {
    //source指明了parser离开的位置，以便下一个parser介入
    constructor(public value: T, public source: Source) { }
}
class Source {
    //追踪正在解析的字符串和正在匹配的字符串的位置
    constructor(public string: string,
        public index: number) { }
    match(regexp: RegExp): (ParseResult<string> | null) {
        console.assert(regexp['sticky']);
        regexp.lastIndex = this.index;
        let match = this.string.match(regexp);
        //console.log('matching', regexp, 'at index', this.index,
        //            'gave', match && JSON.stringify(match[0]));
        if (match) {
            let value = match[0];
            //更新正在匹配的位置
            let source = new Source(this.string, this.index + value.length);
            return new ParseResult(value, source);
        }
        return null;
    }
}
test("Source matching is idempotent", () => {
    let s = new Source('  let', 2);
    let result1 = s.match(/let/y);
    console.assert(result1 !== null && result1.value === 'let');
    console.assert(result1 !== null && result1.source.index == 5);
    let result2 = s.match(/let/y);
    console.assert(result2 !== null && result2.value === 'let');
    console.assert(result2 !== null && result2.source.index == 5);
});
//解析器的自然实现
class Parser<T> {
    //构造器参数就是parse方法
    constructor(public parse: (s: Source) => (ParseResult<T> | null)) { }
    /* Primitive combinators */
    static regexp(regexp: RegExp): Parser<string> {
        return new Parser(source => source.match(regexp));
    }
    //The notation does not concern itself with what value is produced,
    //only with what string is recognized.
    static constant<U>(value: U): Parser<U> {
        return new Parser(source => new ParseResult(value, source));
    }
    static error<U>(message: string): Parser<U> {
        return new Parser(source => { throw Error(message) });
        // return new Parser(source => { throw Error(source.string.slice(source.index)) });
    }
    //即prioritized选择运算，和unordered选择运算相对，因为从左到右解析
    or(parser: Parser<T>): Parser<T> {
        return new Parser((source) => {
            let result = this.parse(source);
            if (result)
                return result;
            else
                return parser.parse(source);
        });
    }

}

//实现AST抽象语法树接口，指明类要实现的方法
interface AST {
    equals(node: AST): boolean;
}

class Number implements AST {
    constructor(public value: number) { }
    equals(other: AST): boolean {
        return other instanceof Number &&
            this.value === other.value
    }
}
class Id implements AST {
    constructor(public value: string) { }
    equals(other: AST): boolean {
        return other instanceof Id &&
            this.value === other.value
    }
}
//以下类型build upon上述两种基本类型
class Not implements AST {
    //注意这里参数的类型和Number和Id不同
    constructor(public term: AST) { }
    equals(other: AST): boolean {
        //调用AST的equals方法
        return other instanceof Not &&
            this.term.equals(other.term);
    }
}
class Equal implements AST {
    //二元运算符
    constructor(public left: AST, public right: AST) { }
    equals(other: AST): boolean {
        return other instanceof Equal &&
            this.left.equals(other.left) &&
            this.right.equals(other.right);
    }
}
class NotEqual implements AST {
    constructor(public left: AST, public right: AST) { }
    //equals方法只是表示left和right长得一模一样，和类名无关
    equals(other: AST): boolean {
        return other instanceof NotEqual &&
            this.left.equals(other.left) &&
            this.right.equals(other.right);
    }
}
class Add implements AST {
    constructor(public left: AST, public right: AST) { }
    equals(other: AST): boolean {
        return other instanceof Add &&
            this.left.equals(other.left) &&
            this.right.equals(other.right);
    }
}
class Subtract implements AST {
    constructor(public left: AST, public right: AST) { }
    equals(other: AST): boolean {
        return other instanceof Subtract &&
            this.left.equals(other.left) &&
            this.right.equals(other.right);
    }
}
class Multiply implements AST {
    constructor(public left: AST, public right: AST) { }
    equals(other: AST): boolean {
        return other instanceof Multiply &&
            this.left.equals(other.left) &&
            this.right.equals(other.right);
    }
}
class Divide implements AST {
    constructor(public left: AST, public right: AST) { }
    equals(other: AST): boolean {
        return other instanceof Divide &&
            this.left.equals(other.left) &&
            this.right.equals(other.right);
    }
}
class Call implements AST {
    //参数分别是方法名以及参数
    constructor(public callee: string, public args: Array<AST>) { }
    equals(other: AST): boolean {
        return other instanceof Call &&
            this.callee === other.callee &&
            this.args.length === other.args.length &&
            this.args.every((arg, i) => arg.equals(other.args[i]));
    }
}
class Return implements AST {
    constructor(public term: AST) { }
    equals(other: AST): boolean {
        return other instanceof Return &&
            this.term.equals(other.term);
    }
}
class Block implements AST {
    constructor(public statements: Array<AST>) { }
    equals(other: AST): boolean {
        return other instanceof Block &&
            this.statements.length === other.statements.length &&
            this.statements.every((statement, i) =>
                statement.equals(other.statements[i]));
    }
}
class If implements AST {
    constructor(public conditional: AST,
        public consequence: AST,
        public alternative: AST) { }
    equals(other: AST): boolean {
        return other instanceof If &&
            this.conditional.equals(other.conditional) &&
            this.consequence.equals(other.consequence) &&
            this.alternative.equals(other.alternative);
    }
}
class Function implements AST {
    constructor(public name: string,
        public parameters: Array<string>,
        public body: AST) { }
    equals(other: AST): boolean {
        return other instanceof Function &&
            this.name === other.name &&
            this.parameters.length === other.parameters.length &&
            this.parameters.every((parameter, i) =>
                parameter === other.parameters[i]) &&
            this.body.equals(other.body);
    }
}
class Var implements AST {
    constructor(public name: string, public value: AST) { }
    equals(other: AST): boolean {
        return other instanceof Var &&
            this.name === other.name &&
            this.value.equals(other.value);
    }
}
class Assign implements AST {
    constructor(public name: string, public value: AST) { }
    equals(other: AST): boolean {
        return other instanceof Assign &&
            this.name === other.name &&
            this.value.equals(other.value);
    }
}
class While implements AST {
    constructor(public conditional: AST, public body: AST) { }
    equals(other: AST): boolean {
        return other instanceof While &&
            this.conditional.equals(other.conditional) &&
            this.body.equals(other.body);
    }
}

export { }; //解决模块重名问题

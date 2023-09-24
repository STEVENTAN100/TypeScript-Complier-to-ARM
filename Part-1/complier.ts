let emit = console.log;

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

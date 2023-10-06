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
  //实现正则表达式*运算
  static zeroOrMore<U>(parser: Parser<U>): Parser<Array<U>> {
    return new Parser(source => {
      let results: Array<any> = [];
      let item;
      while (item = parser.parse(source)) {
        source = item.source;
        results.push(item.value);
      }
      return new ParseResult(results, source);
    });
  }
  //实现值和名字的绑定，很有趣的方法！
  bind<U>(callback: (t: T) => Parser<U>): Parser<U> {
    return new Parser((source) => {
      let result = this.parse(source);
      if (result)
        return callback(result.value).parse(result.source);
      else
        return null;
    });
  }
  /* Non-primitive, composite combinators */
  //like bind，但不绑定名字
  and<U>(parser: Parser<U>): Parser<U> {
    return this.bind((_) => parser);
  }
  //binding name only to return a constant parser immediately
  map<U>(callback: (t: T) => U): Parser<U> {
    return this.bind((value) => constant(callback(value)));
  }
  //实现正则表达式?运算
  static maybe<U>(parser: Parser<U | null>): Parser<U | null> {
    return parser.or(constant(null));
  }
  //一个helper方法，接受字符串作为参数
  parseStringToCompletion(string: string): T {
    let source = new Source(string, 0);
    let result = this.parse(source);
    if (!result)
      throw Error("Parse error: could not parse anything at all");
    let index = result.source.index;
    if (index != result.source.string.length)
      throw Error("Parse error at index " + index);
    return result.value;
  }
}
let { regexp, constant, maybe, zeroOrMore, error } = Parser;
//一些测试
test("Parsing alternatives with `or`", () => {
  let parser = regexp(/bye/y).or(regexp(/hai/y));
  let result = parser.parseStringToCompletion('hai');
  console.assert(result == 'hai');
});
test("Parsing with bindings", () => {
  let parser = regexp(/[a-z]+/y).bind((word) =>
    regexp(/[0-9]+/y).bind((digits) =>
      constant(`first ${word}, then ${digits}`)));
  let result = parser.parseStringToCompletion('hai123');
  console.assert(result == 'first hai, then 123');
});

//First Pass
//whitespace and comments
let whitespace = regexp(/[ \n\t\r]+/y);
//.表示任意字符，除了换行，s则表示可以换行，因而实现多行注释
let comments = regexp(/[/][/].*/y).or(regexp(/[/][*].*[*][/]/sy));
let ignored = zeroOrMore(whitespace.or(comments));

let token = (pattern: RegExp) =>
  Parser.regexp(pattern).bind((value) =>
    ignored.and(constant(value)));
// Keywords, \b represents word-break escape sequence
let FUNCTION = token(/function\b/y);
let IF = token(/if\b/y);
let WHILE = token(/while\b/y);
let ELSE = token(/else\b/y);
let RETURN = token(/return\b/y);
let VAR = token(/var\b/y);

let COMMA = token(/[,]/y);
let SEMICOLON = token(/;/y);
let LEFT_PAREN = token(/[(]/y);
let RIGHT_PAREN = token(/[)]/y);
let LEFT_BRACE = token(/[{]/y);
let RIGHT_BRACE = token(/[}]/y);

//only intergers on baseline complier
let NUMBER = token(/[0-9]+/y).map((digits) =>
  new Number(parseInt(digits, 10)));

let ID = token(/[a-zA-Z_][a-zA-Z0-9_]*/y);
//产生AST结点的id，而不是字符串
let id = ID.map((x) => new Id(x));

// Operators
let NOT = token(/!/y).map((_) => Not);
let EQUAL = token(/==/y).map((_) => Equal);
let NOT_EQUAL = token(/!=/y).map((_) => NotEqual);
let PLUS = token(/[+]/y).map((_) => Add);
let MINUS = token(/[-]/y).map((_) => Subtract);
let STAR = token(/[*]/y).map((_) => Multiply);
let SLASH = token(/[\/]/y).map((_) => Divide);
let ASSIGN = token(/=/y).map((_) => Assign);

//Grammar，Javascript不允许递归的值，所以用一个error parser来表示expression
let expression: Parser<AST> = Parser.error("expression parser used before definition");

// args <- (expression (COMMA expression)*)?
let args: Parser<Array<AST>> = expression.bind((arg) =>
  zeroOrMore(COMMA.and(expression)).bind((args) =>
    constant([arg, ...args]))).or(constant([]))

// call <- ID LEFT_PAREN args RIGHT_PAREN
let call: Parser<AST> = ID.bind((callee) =>
  LEFT_PAREN.and(args.bind((args) =>
    RIGHT_PAREN.and(constant(new Call(callee, args))))));

// atom <- call / ID / NUMBER / LEFT_PAREN expression RIGHT_PAREN
let atom: Parser<AST> = call.or(id).or(NUMBER)
  .or(LEFT_PAREN.and(expression).bind((e) => RIGHT_PAREN.and(constant(e))));

// unary <- NOT? atom
// catch-all phrase when binding expressions or statements
let unary: Parser<AST> =
  maybe(NOT).bind((not) =>
    atom.map((term) => not ? new Not(term) : term));

//中缀表达式运算符：低优先级build upon高优先级
let infix = (operatorParser: Parser<new (left: AST, right: AST) => AST>, termParser: Parser<AST>) =>
  termParser.bind((term) => zeroOrMore(operatorParser.bind((operator) =>
    termParser.bind((term) => constant({ operator, term })))).map((operatorTerms) =>
      operatorTerms.reduce((left, { operator, term }) => new operator(left, term), term)));

// product <- unary ((STAR / SLASH) unary)*
let product = infix(STAR.or(SLASH), unary);

// sum <- product ((PLUS / MINUS) product)*
let sum = infix(PLUS.or(MINUS), product);

// comparison <- sum ((EQUAL / NOT_EQUAL) sum)*
let comparison = infix(EQUAL.or(NOT_EQUAL), sum);

// expression <- comparison
expression.parse = comparison.parse;

let statement: Parser<AST> = Parser.error("statement parser used before definition");

// returnStatement <- RETURN expression SEMICOLON
let returnStatement: Parser<AST> =
  RETURN.and(expression).bind((term) =>
    SEMICOLON.and(constant(new Return(term))));

// expressionStatement <- expression SEMICOLON
let expressionStatement: Parser<AST> =
  expression.bind((term) => SEMICOLON.and(constant(term)));

// ifStatement <-
//   IF LEFT_PAREN expression RIGHT_PAREN statement ELSE statement
let ifStatement: Parser<AST> =
  IF.and(LEFT_PAREN).and(expression).bind((conditional) =>
    RIGHT_PAREN.and(statement).bind((consequence) =>
      ELSE.and(statement).bind((alternative) =>
        constant(new If(conditional, consequence, alternative)))));

// whileStatement <-
//   WHILE LEFT_PAREN expression RIGHT_PAREN statement
let whileStatement: Parser<AST> =
  WHILE.and(LEFT_PAREN).and(expression).bind((conditional) =>
    RIGHT_PAREN.and(statement).bind((body) =>
      constant(new While(conditional, body))));

// varStatement <-
//   VAR ID ASSIGN expression SEMICOLON
let varStatement: Parser<AST> =
  VAR.and(ID).bind((name) =>
    ASSIGN.and(expression).bind((value) =>
      SEMICOLON.and(constant(new Var(name, value)))));

// assignmentStatement <- ID ASSIGN expression SEMICOLON
let assignmentStatement: Parser<AST> =
  ID.bind((name) =>
    ASSIGN.and(expression).bind((value) =>
      SEMICOLON.and(constant(new Assign(name, value)))));

// blockStatement <- LEFT_BRACE statement* RIGHT_BRACE
let blockStatement: Parser<Block> =
  LEFT_BRACE.and(zeroOrMore(statement)).bind((statements) =>
    RIGHT_BRACE.and(constant(new Block(statements))));

// parameters <- (ID (COMMA ID)*)?
let parameters: Parser<Array<string>> =
  ID.bind((param) =>
    zeroOrMore(COMMA.and(ID)).bind((params) =>
      constant([param, ...params]))).or(constant([]))

// functionStatement <-
//   FUNCTION ID LEFT_PAREN parameters RIGHT_PAREN blockStatement
let functionStatement: Parser<AST> =
  FUNCTION.and(ID).bind((name) =>
    LEFT_PAREN.and(parameters).bind((parameters) =>
      RIGHT_PAREN.and(blockStatement).bind((block) =>
        constant(new Function(name, parameters, block)))));

// statement <- returnStatement 
//            / ifStatement 
//            / whileStatement 
//            / varStatement 
//            / assignmentStatement 
//            / blockStatement
//            / functionStatement
//            / expressionStatement 
let statementParser: Parser<AST> =
  // TODO: order is not the same as in grammar, does it matter?
  returnStatement
    .or(functionStatement)
    .or(ifStatement)
    .or(whileStatement)
    .or(varStatement)
    .or(assignmentStatement)
    .or(blockStatement)
    .or(expressionStatement);

statement.parse = statementParser.parse;

//解析器可以接受多条语句
let parser: Parser<AST> =
  ignored.and(zeroOrMore(statement)).map((statements) =>
    new Block(statements));
//EndOfParser

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
//EndOfAST

//Testing

test("Parser integration test", () => {
  let source = `
    function factorial(n) {
      var result = 1;
      while (n != 1) {
        result = result * n;
        n = n - 1;
      }
      return result;
    }
  `;

  let expected = new Block([
    new Function("factorial", ["n"], new Block([
      new Var("result", new Number(1)),
      new While(new NotEqual(new Id("n"), new Number(1)), new Block([
        new Assign("result", new Multiply(new Id("result"), new Id("n"))),
        new Assign("n", new Subtract(new Id("n"), new Number(1))),
      ])),
      new Return(new Id("result")),
    ])),
  ]);

  let result = parser.parseStringToCompletion(source);
  //console.log(result);
  console.assert(result.equals(expected));
});

export { }; //解决模块重名问题

// Tests to see if the entire development environment is configured correctly.

interface IGameConsoleInformation {
    name: string;
    year: number;
}

const s: IGameConsoleInformation = {
    name: "Nintendo Entertainment System",
    year: 1985
};

console.log("Hello.", s.name, "was released in", s.year);
String.prototype.trimIndent = function (): string {
    const lines = this.replace(/^\n/, "").split("\n");
    const indent = lines.filter(line => line.trim()).reduce((minIndent, line) => {
        const match = line.match(/^(\s*)/);
        const currIndent = match ? match[1].length : 0;
        return minIndent === null ? currIndent : Math.min(minIndent, currIndent);
    }, null as number | null) || 0;
    return lines.map(line => line.slice(indent)).join("\n").trim();
};
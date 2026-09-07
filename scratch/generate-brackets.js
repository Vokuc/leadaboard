const fs = require('fs');
const path = require('path');

function generateBracketSVG(numTeams) {
    const rounds = Math.log2(numTeams);
    const matchWidth = 150;
    const roundSpacing = 200;
    const verticalSpacing = 40;
    
    const totalHeight = numTeams * verticalSpacing + 150;
    const totalWidth = (rounds + 1) * roundSpacing + 100;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}">\n`;
    svg += `<rect width="100%" height="100%" fill="#ffffff"/>\n`;
    svg += `<text x="${totalWidth/2}" y="50" font-family="Arial" font-size="28" font-weight="bold" text-anchor="middle" fill="#000000">${numTeams}-Team Tournament Bracket</text>\n`;

    let currentRoundY = [];
    for (let i = 0; i < numTeams; i++) {
        currentRoundY.push(100 + i * verticalSpacing);
    }

    for (let r = 0; r < rounds; r++) {
        const nextRoundY = [];
        const xOffset = 50 + r * roundSpacing;

        for (let i = 0; i < currentRoundY.length; i += 2) {
            const y1 = currentRoundY[i];
            const y2 = currentRoundY[i+1];
            const midY = (y1 + y2) / 2;
            nextRoundY.push(midY);

            svg += `<line x1="${xOffset}" y1="${y1}" x2="${xOffset + matchWidth}" y2="${y1}" stroke="#000" stroke-width="2"/>\n`;
            svg += `<line x1="${xOffset}" y1="${y2}" x2="${xOffset + matchWidth}" y2="${y2}" stroke="#000" stroke-width="2"/>\n`;
            svg += `<line x1="${xOffset + matchWidth}" y1="${y1}" x2="${xOffset + matchWidth}" y2="${y2}" stroke="#000" stroke-width="2"/>\n`;
            svg += `<line x1="${xOffset + matchWidth}" y1="${midY}" x2="${xOffset + matchWidth + 20}" y2="${midY}" stroke="#000" stroke-width="2"/>\n`;
        }
        currentRoundY = nextRoundY;
    }

    const finalY = currentRoundY[0];
    const finalX = 50 + rounds * roundSpacing;
    svg += `<line x1="${finalX - roundSpacing + matchWidth + 20}" y1="${finalY}" x2="${finalX + matchWidth}" y2="${finalY}" stroke="#000" stroke-width="2"/>\n`;
    svg += `<text x="${finalX + matchWidth / 2}" y="${finalY - 10}" font-family="Arial" font-size="20" text-anchor="middle" fill="#000000">Winner</text>\n`;

    svg += `</svg>`;
    return svg;
}

const dir = path.join(__dirname, '..', 'public', 'resources');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, '8-team-bracket.svg'), generateBracketSVG(8));
fs.writeFileSync(path.join(dir, '16-team-bracket.svg'), generateBracketSVG(16));
fs.writeFileSync(path.join(dir, '32-team-bracket.svg'), generateBracketSVG(32));

console.log('SVGs generated successfully!');

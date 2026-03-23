const fs = require('fs');
const path = require('path');

let content = null;
const encodings = ['utf8', 'gbk', 'gb2312', 'latin1'];

for (const enc of encodings) {
    try {
        content = fs.readFileSync('D:\\Openclaw\\typecho_contents.sql', enc);
        console.log(`Using encoding: ${enc}`);
        break;
    } catch (e) {
        continue;
    }
}

if (!content) {
    console.log('Failed to read file');
    process.exit(1);
}

const posts = [];
const lines = content.split('\n');
let buffer = '';
let inInsert = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('INSERT INTO') && line.includes('VALUES')) {
        inInsert = true;
    }
    if (inInsert) {
        buffer += line + '\n';
        if (line.trim().endsWith(';')) {
            const records = buffer.match(/\((\d+),\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*(\d+),\s*'([^']*)',/g);
            if (records) {
                for (const record of records) {
                    const match = record.match(/\((\d+),\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*(\d+),\s*'([^']*)'/);
                    if (match) {
                        const [, cid, title, slug, created, modified, text] = match;
                        if (title && title.length > 1 && text && text.length > 10) {
                            posts.push({
                                cid: parseInt(cid),
                                title: title.trim(),
                                slug: slug.trim(),
                                created: parseInt(created),
                                modified: parseInt(modified),
                                text: text
                            });
                        }
                    }
                }
            }
            buffer = '';
            inInsert = false;
        }
    }
}

console.log(`Found ${posts.length} posts`);

const hugoDir = 'C:\\Users\\wineg\\myblog\\content\\posts';

const existingFiles = fs.readdirSync(hugoDir);
for (const f of existingFiles) {
    if (f.endsWith('.md')) {
        fs.unlinkSync(path.join(hugoDir, f));
    }
}

let count = 0;
posts.forEach((post) => {
    try {
        const date = new Date(post.created * 1000);
        const dateStr = date.toISOString().slice(0, 10);
        
        let text = post.text;
        text = text.replace(/<!--markdown-->/g, '');
        text = text.replace(/<br\s*\/?>/gi, '\n');
        text = text.replace(/<p>/gi, '\n');
        text = text.replace(/<\/p>/gi, '\n');
        text = text.replace(/<strong>([^<]*)<\/strong>/gi, '**$1**');
        text = text.replace(/<b>([^<]*)<\/b>/gi, '**$1**');
        text = text.replace(/<img\s+src="([^"]*)"\s*\/?>/gi, '![]($1)');
        text = text.replace(/<a\s+href="([^"]*)">([^<]*)<\/a>/gi, '[$2]($1)');
        text = text.replace(/<[^>]+>/g, '');
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        
        // 安全处理标题
        let safeTitle = post.title
            .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 30)
            .trim();
        if (!safeTitle || safeTitle.length < 2) {
            safeTitle = `post-${post.cid}`;
        }
        
        // 清理标题用于front matter
        const titleForFrontMatter = post.title
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '')
            .replace(/\n/g, ' ')
            .substring(0, 80);
        
        const hugoContent = '+++\n' +
            'title = "' + titleForFrontMatter + '"\n' +
            'date = ' + dateStr + '\n' +
            'draft = false\n' +
            '+++\n\n' +
            text + '\n';
        
        fs.writeFileSync(path.join(hugoDir, `${safeTitle}.md`), hugoContent, 'utf8');
        count++;
    } catch (e) {
        // skip
    }
});

console.log(`Created ${count} Hugo posts`);

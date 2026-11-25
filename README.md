# A World Warming Unevenly · Team 404

| 部分 | 入口 | 内容与维护范围 |
|---|---|---|
| 总导航 | index.html | 四个 tab；统一由 Yifei 维护 |
| Part 1 | part1/index.html | Bill：排放不平等图与 chart.js |
| Part 2 | part2/index.html | Bill：industry/ 工业排放图；warming/ 排放与升温图 |
| Part 3 | part3/index.html | Yifei：蜂窝地图、Brazil、California、India；Mianzhi：中国放 china/ |
| Part 4 | part4/index.html | 尚未制作，当前仅占位，不包含中国页面 |

## 中国文件

Mianzhi 的全部现有文件集中在 part3/china/：index.html 为中国入口，yangtze.html 为历史专题，regions.html 为情景比较，其余 JS、CSS、world.geojson、D3 和两个导出脚本放在同目录。JSON 生成后也放在此目录：yangtze.json、climate.json。二者当前未随仓库提交；不使用虚构数据代替。不要提交大型原始 NPZ。

## 团队协作

只编辑自己负责的目录。不要让每个成员都替换根目录 index.html。共享入口修改通过 PR 协商；提交前先同步 main，再创建个人分支。iframe 隔离运行时脚本和样式；Git 中的覆盖仍靠目录分工和审查避免。使用 Live Server 或 GitHub Pages，不要双击文件测试全部功能。

不保留旧的 part 1 and 2/ 文件夹；图表均已移动到各自部分。.DS_Store 属于系统目录元数据，已移出项目并忽略。

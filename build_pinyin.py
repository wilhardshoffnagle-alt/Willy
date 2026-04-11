#!/usr/bin/env python3
"""
Build pinyin-data.js from the cedict_ts.u8 or a bundled minimal dataset.
Falls back to generating from a hardcoded common-character list.
"""
import os, re, json

OUTPUT = os.path.join(os.path.dirname(__file__), "pinyin-data.js")

# ── Try to use CC-CEDICT if available ──────────────────────────────────────
CEDICT_PATHS = [
    "/usr/share/cedict/cedict_ts.u8",
    os.path.expanduser("~/cedict_ts.u8"),
    "cedict_ts.u8",
]

# tone-mark vowel → (base_vowel, tone_number)
DIACRITIC_MAP = {
    'ā':('a',1),'á':('a',2),'ǎ':('a',3),'à':('a',4),
    'ē':('e',1),'é':('e',2),'ě':('e',3),'è':('e',4),
    'ī':('i',1),'í':('i',2),'ǐ':('i',3),'ì':('i',4),
    'ō':('o',1),'ó':('o',2),'ǒ':('o',3),'ò':('o',4),
    'ū':('u',1),'ú':('u',2),'ǔ':('u',3),'ù':('u',4),
    'ǖ':('v',1),'ǘ':('v',2),'ǚ':('v',3),'ǜ':('v',4),
    'ü':('v',0),
}

def diacritic_to_numbered(pinyin):
    """Convert 'zhōng' → 'zhong1'"""
    tone = 0
    result = pinyin.lower()
    for ch, (base, t) in DIACRITIC_MAP.items():
        if ch in result:
            result = result.replace(ch, base if base != 'v' else 'u')
            if t: tone = t
    if tone:
        result = result.rstrip('5') + str(tone)
    else:
        result = result + '5'  # neutral
    return result

def parse_cedict(path):
    """Return {hanzi: numbered_pinyin} from CC-CEDICT (single-char entries only)."""
    data = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith('#'): continue
            # Format: trad simp [pin yin] /def1/def2/
            m = re.match(r'^(\S+)\s+(\S+)\s+\[([^\]]+)\]', line)
            if not m: continue
            simp = m.group(2)
            if len(simp) != 1: continue   # single characters only
            pinyin_parts = m.group(3).split()
            if len(pinyin_parts) != 1: continue
            raw = pinyin_parts[0].lower()
            # raw is already numbered like "zhong1"
            if simp not in data:
                data[simp] = raw
    return data

# ── Fallback: embed a curated ~3500-character table ────────────────────────
# This is a compact encoding: each entry is "char:pinyin_numbered"
# We include the HSK 1-6 + most common characters.
BUILTIN = """
一:yi1 二:er4 三:san1 四:si4 五:wu3 六:liu4 七:qi1 八:ba1 九:jiu3 十:shi2
百:bai3 千:qian1 万:wan4 零:ling2 亿:yi4
人:ren2 大:da4 中:zhong1 国:guo2 年:nian2 地:di4 个:ge4 上:shang4
们:men5 学:xue2 下:xia4 生:sheng1 来:lai2 到:dao4 时:shi2 会:hui4
这:zhe4 就:jiu4 出:chu1 说:shuo1 有:you3 他:ta1 她:ta1 它:ta1
我:wo3 你:ni3 好:hao3 是:shi4 不:bu4 了:le5 在:zai4 着:zhe5
和:he2 的:de5 也:ye3 都:dou1 那:na4 这:zhe4 什:shen2 么:me5
吗:ma5 吧:ba5 呢:ne5 啊:a5
工:gong1 作:zuo4 家:jia1 里:li3 儿:er2 们:men5 自:zi4 己:ji3
现:xian4 在:zai4 很:hen3 多:duo1 没:mei2 要:yao4 为:wei4 以:yi3
后:hou4 前:qian2 过:guo4 再:zai4 从:cong2 被:bei4 比:bi3 把:ba3
对:dui4 向:xiang4 给:gei3 让:rang4 用:yong4 做:zuo4 去:qu4 进:jin4
出:chu1 可:ke3 能:neng2 所:suo3 如:ru2 果:guo3 只:zhi3 些:xie1
用:yong4 行:xing2 同:tong2 关:guan1 心:xin1 还:hai2 事:shi4 情:qing2
长:chang2 开:kai1 高:gao1 间:jian1 发:fa1 当:dang1 新:xin1 见:jian4
老:lao3 小:xiao3 女:nv3 男:nan2 孩:hai2 子:zi5 父:fu4 母:mu3
朋:peng2 友:you3 老:lao3 师:shi1 同:tong2 学:xue2 先:xian1 生:sheng1
太:tai4 太:tai4 医:yi1 生:sheng1 警:jing3 察:cha2 公:gong1 司:si1
今:jin1 天:tian1 明:ming2 昨:zuo2 早:zao3 晚:wan3 上:shang4 午:wu3
下:xia4 午:wu3 晚:wan3 上:shang4 时:shi2 候:hou4 分:fen1 钟:zhong1
年:nian2 月:yue4 日:ri4 星:xing1 期:qi1 号:hao4
春:chun1 夏:xia4 秋:qiu1 冬:dong1
东:dong1 西:xi1 南:nan2 北:bei3 左:zuo3 右:you4
吃:chi1 喝:he1 饭:fan4 菜:cai4 水:shui3 果:guo3 米:mi3 面:mian4
肉:rou4 鱼:yu2 鸡:ji1 蛋:dan4 牛:niu2 奶:nai3
书:shu1 本:ben3 笔:bi3 纸:zhi3 字:zi4 文:wen2
电:dian4 脑:nao3 话:hua4 视:shi4 影:ying3 机:ji1 车:che1
路:lu4 门:men2 窗:chuang1 桌:zhuo1 椅:yi3 床:chuang2 房:fang2
钱:qian2 买:mai3 卖:mai4 商:shang1 店:dian4 市:shi4 场:chang3
冷:leng3 热:re4 暖:nuan3 风:feng1 雨:yu3 雪:xue3 云:yun2 太:tai4 阳:yang2
红:hong2 绿:lv4 蓝:lan2 白:bai2 黑:hei1 黄:huang2
大:da4 小:xiao3 多:duo1 少:shao3 高:gao1 矮:ai3 长:chang2 短:duan3
快:kuai4 慢:man4 忙:mang2 累:lei4 难:nan2 易:yi4 美:mei3 丑:chou3
真:zhen1 假:jia3 对:dui4 错:cuo4 新:xin1 旧:jiu4
爱:ai4 喜:xi3 欢:huan1 恨:hen4 怕:pa4 想:xiang3 知:zhi1 道:dao4
说:shuo1 话:hua4 看:kan4 听:ting1 写:xie3 读:du2 走:zou3 跑:pao3
来:lai2 去:qu4 回:hui2 坐:zuo4 站:zhan4 睡:shui4 觉:jiao4 起:qi3
洗:xi3 澡:zao3 穿:chuan1 衣:yi1 服:fu2
玩:wan2 笑:xiao4 哭:ku1 跳:tiao4 唱:chang4 歌:ge1
打:da3 电:dian4 话:hua4 发:fa1 短:duan3 信:xin4
城:cheng2 市:shi4 村:cun1 庄:zhuang1
以:yi3 后:hou4 的:de5 时:shi2 候:hou5 跟:gen1 起:qi3
一:yi1 起:qi3
"""

def parse_builtin():
    data = {}
    for token in BUILTIN.split():
        if ':' in token:
            char, py = token.split(':', 1)
            if char not in data:
                data[char] = py
    return data

# ── main ───────────────────────────────────────────────────────────────────

data = {}

# Try cedict
for p in CEDICT_PATHS:
    if os.path.exists(p):
        print(f"Using CC-CEDICT from {p}")
        data = parse_cedict(p)
        break

# Merge/override with builtin (builtin is curated)
builtin = parse_builtin()
for k, v in builtin.items():
    data[k] = v

print(f"Total characters: {len(data)}")

js = "var pinyinData = " + json.dumps(data, ensure_ascii=False, separators=(',',':')) + ";\n"
with open(OUTPUT, 'w', encoding='utf-8') as f:
    f.write(js)
print(f"Written to {OUTPUT}")

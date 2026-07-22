/* ═══════════════════════════════════════════════════════
   go2 cheatsheet — knowledge_data.js
   各ナレッジリンクの「詳細情報」（アクセスせずアプリ内で読める）
   knowledgeSeedIfEmpty() でタイトルをキーに結合される。

   detail = {
     overview,        何のサイト/ツールか
     keyPoints[],     要点・特徴
     usage[{label,content}],  使い方・コマンド（ツール系は充実、参照系は道案内）
     oswaTips,        OSWA文脈での使いどころ
     lastCurated,     整理日（案2で最新取得時に上書き）
   }
   ※ 巨大な参照系（HackTricks/PortSwigger/MDN等）は全文転載せず、
     「何がどこにあるか・どう使うか」の道案内に徹する。
════════════════════════════════════════════════════════ */
const KNOWLEDGE_DETAILS = {
  // ───────── ツール系（深く） ─────────
  "ffuf": {
    overview: "Go製の高速Webファザー。FUZZ キーワードを URL・ヘッダー・POSTデータの任意の位置に置き、ワードリストで総当りする。ディレクトリ探索・パラメータ発見・認証総当り・VHost発見まで幅広く使える。",
    keyPoints: [
      "FUZZ キーワードを置いた位置を総当りする（URL/ヘッダー/POSTボディ どこでも）",
      "レスポンスの差異でフィルタ: -fs（サイズ）/-fc（ステータス）/-fw（単語数）/-fl（行数）",
      "逆に一致だけ拾う matcher: -mc（ステータス）/-ms（サイズ）等",
      "-ac で自動キャリブレーション（ベースラインを自動学習して誤検知を除去）",
      "-request でBurpの生リクエストをそのまま読み込み、FUZZ を仕込める（ヘッダー指定の手間が省ける）",
      "-recursion で再帰探索、複数ワードリストで clusterbomb/pitchfork/sniper モード",
    ],
    usage: [
      { label: "ディレクトリ探索", content: "ffuf -w /path/wordlist.txt -u https://target/FUZZ" },
      { label: "拡張子を付与して探索", content: "ffuf -w wordlist.txt -u https://target/FUZZ -e .php,.html,.txt" },
      { label: "GETパラメータ名の発見（サイズ4242を除外）", content: "ffuf -w params.txt -u https://target/script.php?FUZZ=test -fs 4242" },
      { label: "パラメータ値の総当り（401を除外）", content: "ffuf -w values.txt -u https://target/script.php?name=FUZZ -fc 401" },
      { label: "POSTデータのFuzzing", content: "ffuf -w postdata.txt -X POST -d \"username=admin&password=FUZZ\" -u https://target/login.php -fc 401" },
      { label: "VHost発見（Hostヘッダー）", content: "ffuf -w vhosts.txt -u https://target -H \"Host: FUZZ\" -fs 4242" },
      { label: "Burpの生リクエストを読み込む", content: "ffuf -request req.txt -request-proto https -w wordlist.txt" },
      { label: "自動キャリブレーション＋再帰", content: "ffuf -w wordlist.txt -u https://target/FUZZ -ac -recursion -recursion-depth 2" },
    ],
    oswaTips: "OSWAでは「Sizeの差異＝認証情報の一致有無」「Statusの差異＝Error-based」「Durationの差異＝Time-based」の切り分けに直結する。Burpで組み立てたリクエストを -request で読み込めば、Cookie やヘッダーを付けたままFuzzingできる。SQLi Point の特定は PayloadsAllTheThings のワードリストと組み合わせると強い。",
    lastCurated: "2026-07-21",
  },
  "CeWL": {
    overview: "対象サイトをスパイダー（クロール）して、ページ中の単語から独自ワードリストを生成する Ruby 製ツール。作った単語リストは John the Ripper 等のパスワードクラックや、ffuf/Hydra の総当りに使う。「そのサイト特有の用語」を突く時に効く。",
    keyPoints: [
      "デフォルトは深さ2でクロール、3文字以上の単語を出力",
      "-d で深さ、-m で最小文字数、-w で出力ファイル指定",
      "-a/--meta でファイルのメタデータ、-e/--email でメールアドレスも収集",
      "--with-numbers で数字入り単語も許可（パスワードっぽい語を拾える）",
      "認証・プロキシ対応（--auth_type / --proxy_host 等）",
    ],
    usage: [
      { label: "基本（ワードリスト生成）", content: "cewl http://target/ -w wordlist.txt" },
      { label: "深さ・最小文字数を指定", content: "cewl -d 3 -m 5 http://target/ -w words.txt" },
      { label: "数字入り単語も許可", content: "cewl --with-numbers http://target/ -w words.txt" },
      { label: "メール収集", content: "cewl -e --email_file emails.txt http://target/" },
    ],
    oswaTips: "認証情報系のお供に。対象アプリ特有の用語（製品名・人名・専門語）でワードリストを作り、ログイン総当りや ffuf のパラメータ Fuzzing に投入する。汎用ワードリストで刺さらない時の次の一手。",
    lastCurated: "2026-07-21",
  },
  "sqlmap": {
    overview: "SQL injection の検出と悪用を自動化するツール。Burp のリクエストを保存して -r で渡せば、ヘッダーや Cookie の指定を省ける。DB→テーブル→カラムと段階的に列挙してから dump するのがセオリー。",
    keyPoints: [
      "-r request.txt でBurpの生リクエストを読み込み（POSTフォームやCookie込みで楽）",
      "--batch で対話の質問を全部デフォルト(yes)で進める",
      "列挙は dbs → tables → columns → dump の順で徐々に絞る",
      "--dbms を指定すると検出が速くなる（例: --dbms=mysql）",
      "--tamper でWAF回避（例: --tamper=space2comment）",
      "--level / --risk で検査の深さを上げる（デフォルトで出ない時）",
    ],
    usage: [
      { label: "DB列挙", content: "sqlmap -r request.txt --dbs --batch" },
      { label: "テーブル列挙", content: "sqlmap -r request.txt --dbms=mysql -D dbname --tables --batch" },
      { label: "カラム列挙", content: "sqlmap -r request.txt -D dbname -T users --columns --batch" },
      { label: "dump（データ抽出）", content: "sqlmap -r request.txt --dbms=mysql -D dbname -T users --dump --batch" },
      { label: "WAF回避", content: "sqlmap -r request.txt --tamper=space2comment --batch" },
      { label: "検査を深くする", content: "sqlmap -r request.txt --level=5 --risk=3 --batch" },
    ],
    oswaTips: "最初から --dump するととんでもない時間がかかる場合がある。必ず dbs→tables→dump で絞ること。ただし SQLi を sqlmap に頼り切るのは非推奨。OSWA では手動でカラム数特定（ORDER BY）や UNION 抽出ができる必要があるので、sqlmap は「確認・時短」の位置づけで使い、手動も練習しておく。",
    lastCurated: "2026-07-21",
  },
  "AutoRecon-OSWA": {
    overview: "OSWA 向けにチューニングされた自動偵察ツール（AutoRecon の派生）。ターゲットに対してポートスキャンとWeb系の初期列挙を自動で並列実行し、結果をディレクトリに整理してくれる。攻略の最初の「面倒な列挙」を肩代わりする。",
    keyPoints: [
      "nmap を含む複数ツールを自動で並列実行し、結果をファイルに保存",
      "Web ターゲット向けの列挙（ディレクトリ探索等）を含む",
      "手を動かしている間にバックグラウンドで偵察が進むのが利点",
    ],
    usage: [
      { label: "基本実行", content: "autorecon <TARGET_IP>" },
      { label: "リポジトリの手順に従ってセットアップ", content: "# GitHub の README を参照（依存ツールのインストールが必要）" },
    ],
    oswaTips: "偵察を回している間に、自分は手動でWeb UIを触る・Burpでリクエストを観察する、と並行できる。ただし試験では自動ツールの結果を鵜呑みにせず、必ず自分で確認すること。出力の見落としがないかレビューする前提で使う。",
    lastCurated: "2026-07-21",
  },

  // ───────── チートシート/表系（使い方＋代表例＋道案内） ─────────
  "Template Injection Table": {
    overview: "SSTI（サーバサイドテンプレートインジェクション）で、どのテンプレートエンジンか特定するための早見表。44の主要テンプレートエンジンについて、ポリグロット（複数エンジンで反応する検査文字列）とその応答をまとめてある。",
    keyPoints: [
      "手順は2段階: ①検出（Detection） ②特定（Identification）",
      "まず万能エラーベースのポリグロット `<%'${{/#{@}}%>{{` を送る → 多くのエンジンでエラーが出る",
      "エラーが握り潰される場合は、非エラーベースの万能ポリグロット3種を使う（入力が反射される前提）",
      "入力長が短すぎる時は、言語別の短いポリグロットを使う",
      "特定は、残りのポリグロットを送って応答でエンジンを絞り込み、1つになるまでフィルタする",
    ],
    usage: [
      { label: "検出用の万能ポリグロット", content: "<%'${{/#{@}}%>{{" },
      { label: "基本の検出（算術評価）", content: "${7*7}  {{7*7}}  <%= 7*7 %>  #{7*7}  → 49 が返れば SSTI の可能性" },
      { label: "使い方", content: "サイトの表で、送った文字列に対する各エンジンの応答を照合し、エンジンを1つに絞り込む。" },
    ],
    oswaTips: "SSTI で「何のテンプレートエンジンか分からない」時の切り札。エンジンが特定できれば、そのエンジン固有の RCE ペイロード（Jinja2 なら __globals__ 経由等）に進める。まず算術評価で当たりを付け、この表で特定 → ペイロード集/HackTricks で悪用、という流れ。",
    lastCurated: "2026-07-21",
  },
  "PayloadsAllTheThings / SQLi Intruder": {
    overview: "PayloadsAllTheThings の SQL Injection/Intruder ディレクトリ。SQLi の注入ポイント特定に使うワードリスト群。Burp Intruder や ffuf に読み込ませて、どのパラメータが SQLi に反応するかを総当りで炙り出す。",
    keyPoints: [
      "Intruder フォルダには SQLi 検出用のペイロード/ワードリストが入っている",
      "Burp Intruder のペイロードや、ffuf の -w に読み込ませて使う",
      "SQLi 以外にも各脆弱性タイプのワードリストが PayloadsAllTheThings 全体に揃っている",
    ],
    usage: [
      { label: "ffuf でSQLi Point総当り", content: "ffuf -w Intruder/detect.txt -u \"https://target/item?id=FUZZ\" -mr \"SQL syntax\"" },
      { label: "Burp Intruder", content: "Intruder のペイロードにこのリストを読み込み、パラメータ位置に対して発射する" },
      { label: "道案内", content: "リポジトリ内の SQL Injection/Intruder/ を参照。用途別に複数ファイルがある。" },
    ],
    oswaTips: "SQLi の「どこが刺さるか」を機械的に探す段階で使う。ffuf の -mr（正規表現マッチ）で 'SQL syntax' 等のエラー文字列を拾うと、Error-based の注入点が見つかる。刺さったら手動 or sqlmap で深掘り。",
    lastCurated: "2026-07-21",
  },
  "PayloadsAllTheThings": {
    overview: "攻撃ペイロードとバイパス技法の総合リポジトリ。XSS/SQLi/SSTI/SSRF/XXE/コマンドインジェクション/ファイルアップロード等、ほぼ全ての Web 脆弱性タイプについて、悪用ペイロード・WAF回避・方法論がまとまっている。困ったらまず見る定番。",
    keyPoints: [
      "脆弱性タイプごとにフォルダが分かれている（各フォルダに README とペイロード）",
      "各タイプで「基本ペイロード → バイパス → 応用」の順に整理されている",
      "Intruder サブフォルダにはFuzzing用のワードリストがある",
      "OSWA範囲（XSS/SQLi/SSTI/SSRF/XXE/LFI/コマンドインジェクション/IDOR等）を網羅",
    ],
    usage: [
      { label: "道案内: 脆弱性タイプ別フォルダ", content: "例: /XSS Injection/, /SQL Injection/, /Server Side Template Injection/, /XXE Injection/" },
      { label: "使い方", content: "対象の脆弱性タイプのフォルダを開き、README のペイロードを試す → 効かなければバイパス節へ" },
    ],
    oswaTips: "各脆弱性タイプで手詰まりになった時の「次の一手」の宝庫。特に WAF や入力フィルタで基本ペイロードが弾かれた時、そのタイプのバイパス節を見ると回避策が見つかる。アプリの「ペイロード集」モジュールに、刺さったものを写して自分の資産にしていくと良い。",
    lastCurated: "2026-07-21",
  },

  // ───────── ラボ/ドキュメント系（道案内に徹する） ─────────
  "HackTricks": {
    overview: "攻撃手法の百科事典的Wiki。Web・ネットワーク・権限昇格・クラウドまで、ほぼ全ての攻撃カテゴリについて「手順・コマンド・ペイロード」が体系的にまとまっている。ペンテストで最も参照されるリソースの一つ。",
    keyPoints: [
      "左メニューがカテゴリ別（Pentesting Web / Linux・Windows Priv Esc など）",
      "Web脆弱性は「Pentesting Web」配下に各タイプ（XSS/SQLi/SSTI/SSRF/XXE…）",
      "各ページが「検出 → 悪用 → バイパス」の流れで具体的",
      "検索機能で脆弱性名やエラーメッセージから逆引きできる",
    ],
    usage: [
      { label: "道案内: Web脆弱性", content: "Pentesting Web → 各脆弱性ページ（例: SSTI, SQL Injection, XSS, File Inclusion）" },
      { label: "道案内: 方法論", content: "各ページ冒頭に検出方法、後半に悪用・バイパスがある構成" },
      { label: "使い方", content: "脆弱性を疑ったら該当ページを開き、検出ペイロード→悪用手順を上から試す" },
    ],
    oswaTips: "OSWAの各脆弱性で「どう悪用まで持っていくか」に迷ったらここ。特に SSTI のエンジン別 RCE、LFI の各種ラッパー、SQLi の DB別構文など、実戦の具体例が豊富。全文は載せられないので、このアプリからはリンクで開いて該当ページを参照する。",
    lastCurated: "2026-07-21",
  },
  "PortSwigger Web Security Academy": {
    overview: "Burp Suite 開発元 PortSwigger による無料の実践ラボ集。各Web脆弱性タイプについて、解説＋実際に攻撃できるラボが用意されている。読むだけでなく手を動かして習得できるのが最大の価値。OSWA対策の王道教材。",
    keyPoints: [
      "脆弱性タイプごとに Apprentice → Practitioner → Expert の難易度別ラボ",
      "OSWA範囲を網羅: XSS / SQLi / SSRF / XXE / SSTI / OSコマンドインジェクション / パストラバーサル / CSRF / CORS / IDOR / アクセス制御",
      "各トピックに「学習マテリアル（解説）」と「ラボ（実践）」がセット",
      "Burp Community版で全ラボ攻略可能",
    ],
    usage: [
      { label: "道案内: 主要トピック", content: "XSS / SQL injection / SSRF / XXE / SSTI / OS command injection / Path traversal / Access control(IDOR) / CSRF / CORS" },
      { label: "使い方", content: "各トピックの解説を読む → Apprentice ラボから順に手を動かす → Burp Repeater/Intruder で攻撃" },
    ],
    oswaTips: "OSWAの試験範囲とほぼ一致するので、弱いタイプのラボを潰すのが直接の対策になる。特に SSRF/XXE/SSTI/アクセス制御(IDOR) は本番で問われやすい。ラボで身につけた「Burpでの手順」がそのまま試験のレポート再現手順の書き方の練習にもなる。",
    lastCurated: "2026-07-21",
  },
  "MDN Web Docs": {
    overview: "Mozilla による Web 技術の公式リファレンス。HTTP・HTML・JavaScript・DOM・CORS 等の「正しい仕様・挙動」を確認できる。攻撃ツールではないが、脆弱性の理屈を正確に理解する土台になる。",
    keyPoints: [
      "HTTP（ヘッダー・ステータスコード・メソッド・Cookie）の正確な仕様",
      "JavaScript / DOM の挙動（XSS を理解するのに必須）",
      "CORS・同一オリジンポリシーの正確な定義",
      "エンコーディング（URL/HTML エンティティ）の仕様",
    ],
    usage: [
      { label: "道案内: よく引くページ", content: "HTTP headers / HTTP response status codes / CORS / Same-origin policy / Document.cookie" },
      { label: "使い方", content: "攻撃中に「この挙動は仕様上どうなる？」と迷った時に正確な定義を確認する" },
    ],
    oswaTips: "XSS を書く時の DOM/JS の挙動、SSRF/CORS の理解、レスポンスヘッダーの意味など、「なぜそのペイロードが動く/動かないか」を仕様レベルで確認する時に使う。攻略の直接ツールではないが、詰まった時の裏取りに有効。",
    lastCurated: "2026-07-21",
  },
  "machevalia / OSWA": {
    overview: "OSWA 受験者による攻略ノート/チートシートのリポジトリ。試験範囲の脆弱性タイプごとに、手法・コマンド・つまずきポイントが実体験ベースでまとまっている。",
    keyPoints: [
      "OSWA 範囲の脆弱性タイプ別にノートが整理されている",
      "受験者視点の「実戦での勘所」が書かれていることが多い",
      "公式教材の補完として、手順の確認に使える",
    ],
    usage: [
      { label: "使い方", content: "リポジトリの README / 各 .md を脆弱性タイプ別に参照" },
      { label: "道案内", content: "自分の弱いタイプの節を読み、手順やコマンドを確認する" },
    ],
    oswaTips: "公式教材で足りない「実戦の細かいコツ」を補うのに有用。ただし個人ノートなので情報の鮮度・正確性は自分で裏取りすること。HackTricks や PortSwigger と併用して、手順を自分の言葉で再構成しておくとレポート作成が楽になる。",
    lastCurated: "2026-07-21",
  },
  "bastyn / OSWA": {
    overview: "OSWA 受験者による攻略まとめリポジトリ。machevalia と同様、試験範囲の手法・コマンドを個人ノートとして整理したもの。複数の受験者ノートを見比べると、共通して重要な手法が見えてくる。",
    keyPoints: [
      "OSWA 範囲の攻略ノート/チートシート",
      "手法・コマンド・ツールの使い分けが受験者視点でまとまっている",
    ],
    usage: [
      { label: "使い方", content: "リポジトリの各ノートを脆弱性タイプ別に参照" },
      { label: "道案内", content: "machevalia のノートと見比べ、共通して強調される手法を優先的に習得する" },
    ],
    oswaTips: "複数の攻略ノート（machevalia と bastyn）に共通して出てくる手法＝試験で問われやすい可能性が高い、と当たりを付けられる。個人ノートは鵜呑みにせず、公式教材・HackTricks で裏取りしてから自分のチートシート/ツール集に取り込むと良い。",
    lastCurated: "2026-07-21",
  },
};

/* グローバル公開（web.js等と同じ realm 内で参照可能） */
if (typeof window !== "undefined") window.KNOWLEDGE_DETAILS = KNOWLEDGE_DETAILS;

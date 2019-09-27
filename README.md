# GAReport

Google Analytics Premiumユーザー向けSpreadSheetアドオンです。
非サンプリングレポートの抽出やスケジューリング設定などが行えます。

## メニュー

アドオンタブ > GAReport以下に下記の4つのメニューがでます。

* 設定のシートを作る
* 計測開始する
* 非サンプリングレポートを抽出する
* スケジューリングを行う
* スケジューリング一覧
* 入力補助機能
  * 基礎項目一覧
  * セグメント一覧

## Configシートへの記載

アドオンタブ > GAReport > 設定のシートを作る を作成するとReportの設定を記述するためのconfigシートが作成されます。
このシートでは抽出したい各レポートの抽出条件を記述します。
抽出内容な以下の表のとおりです。
(設定を書くためのサポート機能としてアドオンメニューに「入力補助機能」があります)

| 名称 | 必須 | 説明 |
|---|---|---|
|Report Name|◎|レポートの名称。ここに入力した文字列がsheet名になります。|
|Account ID|◎| GAのアカウントIDです。 例( 1111111111 ) <br>GA開いて画面左上|
|Property ID|◎| GAのプロパティIDです。 例( UA-xxxxxxxx-xx )|
|Type|◎|基本的に「core」のままにしておきます。|
|View (Profile) ID / ids|◎|ga:xxxxxxxxというgaから始まる文字列がデフォルトで表示されています。慣れてくるまではそのままの表示を使ってください。|
|Start Date|◎|データ抽出期間の開始日を固定的に設定する場合に使います（2015/01/01など）。他にも本日を指すtodayや7日前の日付を動的に指す、7daysAgo（Aは半角大文字）などが使えます（例 today, yesterday,NdaysAgo）。|
|End Date||データ抽出期間の終了日を固定的に設定する場合に使います。開始日同様に、todayや7daysAgoが使えます。|
|Metrics|◎| Googleアナリティクスで普段利用している指標（セッションやページビュー数など）を対応するコマンド分に入れ替えて、このセルに指定します。”,”カンマで区切って複数入れられます（最大128文字）。<br> <br> <br>https://ga-dev-tools.appspot.com/query-explorer/ <br> https://developers.google.com/analytics/devguides/reporting/core/v3/reference?hl=ja <br> ウェブコンソールの値と、ここで入力する値の対応関係はコチラがわかりやすい|
|Dimensions| | 軸（参照元/メディアやページなど）を対応するコマンド分に入れ替えて、このセルに指定します。”,”カンマで区切って複数入れられます（最大128文字）。<br> <br> https://ga-dev-tools.appspot.com/query-explorer/ <br> https://developers.google.com/analytics/devguides/reporting/core/v3/reference?hl=ja <br> <br>カスタムディメンションを指定するときは、ウェブコンソールに表示されているカスタムディメンションIDを、ga:dimensionXXXへ0埋めなしで設定する。 ウェブコンソールの値と、ここで入力する値の対応関係はコチラがわかりやすい|
|Sort| | ソートの設定をします。昇順、降順を軸や指標に対して設定します。たとえばセッション数で昇順なら、セッション数を示す、ga:sessionsを入力するだけ。降順にする場合は頭にハイフンを付けします。<br>「-ga:sessions」となります。カンマで区切って複数付ければ後ろの要素からソートしてくれます。<br> https://ga-dev-tools.appspot.com/query-explorer/ <br> https://developers.google.com/analytics/devguides/reporting/core/v3/reference?hl=ja |
|Filters| | フィルタの設定をします。指標に対しては数値のフィルタ、軸に対しては文字列のフィルタがかかります。たとえば、ga:sessions<=5 セッション数が5未満、ga:pagepath==/index.html ページが/index.htmlと等しい、という意味になります。<br> https://ga-dev-tools.appspot.com/query-explorer/ <br> https://developers.google.com/analytics/devguides/reporting/core/v3/reference?hl=ja |
|Segment| | GAの標準セグメントまたは自作したセグメントを1つ設定して、さらに保存できます。<br> https://ga-dev-tools.appspot.com/query-explorer/ <br> https://developers.google.com/analytics/devguides/reporting/core/v3/reference?hl=ja |
| Sampling Level| |Googleアナリティクスのサンプリングという機能の効果の度合を指定できます。"FASTER"は処理速度を優先しますがサンプリングの度合は粗く、"HIGHER_PRECISION"は処理速度は優先せずにサンプリングがかかりにくくします。実際はサンプリングがかかると非サンプリングレポートに自動で切り替わるためあまり重要な項目ではありません。|
|Unsampled Report Id| | 自動的に書き込まれるフィールドです。 結果にサンプリングが含まれている場合、ここに非サンプリングレポートのレポートIDが記述されます。|
|Resolve Unsampled Report| | 自動的に書き込まれるフィールドです。 非サンプリングレポートの反映が完了したかどうかがTRUE/FALSEで記載されます。|
|behavior|| 更新の仕方を設定します "all update", "diff update"。　未設定時は"all update"<br> all updateにすると毎回start_date - end_dateの間の期間を抽出します <br> diff updateにすると前回抽出分からの差分の抽出を行います(差分抽出可能なのがga:dateのみになるので、この昨日は第1dimensionがga:dateのものにのみ有効になります)|

設定が完了したら、アドオンメニューから計測を開始するを選択します。

しばらくの実行の後、サンプリングがかかってないレポートはそのまま抽出結果が表示され、そうでないものは非サンプリングレポートのリクエストが投げられている状態になります。

非サンプリングレポートの抽出が終わるころにアドオンメニューの非サンプリングレポートの抽出を選択すると結果が得られます。



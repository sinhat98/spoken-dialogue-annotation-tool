# spoken-dialogue-annotation-tool

このプロジェクトは音声対話のアノテーションツールです。

## 概要

このツールは、音声対話データに対して以下のようなアノテーション作業を支援します：

- 発話区間のラベリング
- 話者の識別
- 対話行為タグの付与
- その他の言語情報のアノテーション

## セットアップ

1. リポジトリのクローン:

## 使用可能なスクリプト

プロジェクトディレクトリで以下のコマンドを実行できます：

### `npm start`

開発モードでアプリを起動します。\
[http://localhost:3000](http://localhost:3000) をブラウザで開いて表示できます。

編集を行うと、ページは自動的に再読み込みされます。\
コンソールに lint エラーも表示されます。

### `npm test`

インタラクティブな監視モードでテストランナーを起動します。\
詳しくは[テストの実行](https://facebook.github.io/create-react-app/docs/running-tests)のセクションをご覧ください。

### `npm run build`

本番用のアプリを `build` フォルダにビルドします。\
Reactを本番モードで正しくバンドルし、最適なパフォーマンスのためにビルドを最適化します。

ビルドは圧縮され、ファイル名にはハッシュが含まれます。\
これでアプリをデプロイする準備が整いました！

詳しくは[デプロイ](https://facebook.github.io/create-react-app/docs/deployment)のセクションをご覧ください。

### `npm run eject`

**注意：これは一方向の操作です。一度 `eject` すると、元に戻すことはできません！**

ビルドツールと設定の選択に満足できない場合は、いつでも `eject` することができます。このコマンドは、プロジェクトから単一のビルド依存関係を削除します。

代わりに、すべての設定ファイルと推移的依存関係（webpack、Babel、ESLintなど）をプロジェクトに直接コピーして、完全に制御できるようになります。`eject` 以外のすべてのコマンドは引き続き動作しますが、コピーされたスクリプトを指すようになるため、それらを調整することができます。この時点で、あなたは独自の判断で進めることになります。

`eject` を使用する必要は必ずしもありません。キュレートされた機能セットは小規模から中規模のデプロイメントに適しており、この機能を使用する義務はありません。ただし、必要なときにカスタマイズできない場合、このツールは役に立たないことを理解しています。

## 詳細情報

[Create React App のドキュメント](https://facebook.github.io/create-react-app/docs/getting-started)で詳細を確認できます。

Reactについて学ぶには、[React のドキュメント](https://reactjs.org/)をご覧ください。

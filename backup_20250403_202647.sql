--
-- PostgreSQL database dump
--

-- Dumped from database version 17.3
-- Dumped by pg_dump version 17.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgroonga; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA public;


--
-- Name: EXTENSION pgroonga; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgroonga IS 'Super fast and all languages supported full text search index based on Groonga';


--
-- Name: knowledge_search_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.knowledge_search_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.answer, '')), 'A') ||     -- 回答を最重要視
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.main_category, '')), 'B') ||  -- メインカテゴリを次に重要視
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.sub_category, '')), 'B') ||   -- サブカテゴリも同様に
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.detail_category, '')), 'B') || -- 詳細カテゴリも同様に
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.question, '')), 'C') ||     -- 質問は参考情報として
    setweight(to_tsvector('japanese_enhanced', COALESCE(NEW.note, '')), 'D');          -- 備考は補足情報として
  RETURN NEW;
END
$$;


ALTER FUNCTION public.knowledge_search_trigger() OWNER TO postgres;

--
-- Name: search_with_synonyms(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_with_synonyms(search_term text) RETURNS TABLE(word text)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT search_term
  UNION
  SELECT synonym FROM "SearchSynonym" WHERE word = search_term
  UNION
  SELECT word FROM "SearchSynonym" WHERE synonym = search_term;
END;
$$;


ALTER FUNCTION public.search_with_synonyms(search_term text) OWNER TO postgres;

--
-- Name: japanese; Type: TEXT SEARCH CONFIGURATION; Schema: public; Owner: postgres
--

CREATE TEXT SEARCH CONFIGURATION public.japanese (
    PARSER = pg_catalog."default" );

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR asciiword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR word WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR numword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR email WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR url WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR host WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR sfloat WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR version WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR hword_numpart WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR hword_part WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR hword_asciipart WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR numhword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR asciihword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR hword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR url_path WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR file WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR "float" WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR "int" WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese
    ADD MAPPING FOR uint WITH simple;


ALTER TEXT SEARCH CONFIGURATION public.japanese OWNER TO postgres;

--
-- Name: japanese_enhanced; Type: TEXT SEARCH CONFIGURATION; Schema: public; Owner: postgres
--

CREATE TEXT SEARCH CONFIGURATION public.japanese_enhanced (
    PARSER = pg_catalog."default" );

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR asciiword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR word WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR numword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR email WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR url WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR host WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR sfloat WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR version WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR hword_numpart WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR hword_part WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR hword_asciipart WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR numhword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR asciihword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR hword WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR url_path WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR file WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR "float" WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR "int" WITH simple;

ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced
    ADD MAPPING FOR uint WITH simple;


ALTER TEXT SEARCH CONFIGURATION public.japanese_enhanced OWNER TO postgres;

--
-- Name: TEXT SEARCH CONFIGURATION japanese_enhanced; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TEXT SEARCH CONFIGURATION public.japanese_enhanced IS '日本語検索用の拡張設定';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AdminUser; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AdminUser" (
    id integer NOT NULL,
    username text NOT NULL,
    email text,
    password_hash text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AdminUser" OWNER TO postgres;

--
-- Name: AdminUser_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."AdminUser_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AdminUser_id_seq" OWNER TO postgres;

--
-- Name: AdminUser_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."AdminUser_id_seq" OWNED BY public."AdminUser".id;


--
-- Name: AlertWord; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AlertWord" (
    id integer NOT NULL,
    word character varying(50) NOT NULL,
    description text,
    related_tag_id integer,
    priority integer DEFAULT 5 NOT NULL
);


ALTER TABLE public."AlertWord" OWNER TO postgres;

--
-- Name: AlertWord_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."AlertWord_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AlertWord_id_seq" OWNER TO postgres;

--
-- Name: AlertWord_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."AlertWord_id_seq" OWNED BY public."AlertWord".id;


--
-- Name: FeedbackWeight; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FeedbackWeight" (
    query_pattern character varying(100) NOT NULL,
    knowledge_id integer NOT NULL,
    weight double precision DEFAULT 1.0 NOT NULL,
    positive_count integer DEFAULT 0 NOT NULL,
    negative_count integer DEFAULT 0 NOT NULL,
    last_updated timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."FeedbackWeight" OWNER TO postgres;

--
-- Name: Knowledge; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Knowledge" (
    id integer NOT NULL,
    main_category character varying(50),
    sub_category character varying(50),
    detail_category character varying(50),
    question text,
    answer text NOT NULL,
    is_template boolean DEFAULT false NOT NULL,
    usage character varying(10),
    note text,
    issue text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    search_vector tsvector
);


ALTER TABLE public."Knowledge" OWNER TO postgres;

--
-- Name: KnowledgeQuestionVariation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."KnowledgeQuestionVariation" (
    id integer NOT NULL,
    knowledge_id integer NOT NULL,
    variation text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."KnowledgeQuestionVariation" OWNER TO postgres;

--
-- Name: KnowledgeQuestionVariation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."KnowledgeQuestionVariation_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."KnowledgeQuestionVariation_id_seq" OWNER TO postgres;

--
-- Name: KnowledgeQuestionVariation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."KnowledgeQuestionVariation_id_seq" OWNED BY public."KnowledgeQuestionVariation".id;


--
-- Name: KnowledgeTag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."KnowledgeTag" (
    knowledge_id integer NOT NULL,
    tag_id integer NOT NULL
);


ALTER TABLE public."KnowledgeTag" OWNER TO postgres;

--
-- Name: Knowledge_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Knowledge_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Knowledge_id_seq" OWNER TO postgres;

--
-- Name: Knowledge_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Knowledge_id_seq" OWNED BY public."Knowledge".id;


--
-- Name: ResponseLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ResponseLog" (
    id integer NOT NULL,
    query text NOT NULL,
    response text NOT NULL,
    used_knowledge_ids integer[],
    missing_tags text[],
    missing_alerts text[],
    feedback boolean,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    knowledge_id integer,
    response_count integer DEFAULT 1 NOT NULL
);


ALTER TABLE public."ResponseLog" OWNER TO postgres;

--
-- Name: ResponseLog_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ResponseLog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."ResponseLog_id_seq" OWNER TO postgres;

--
-- Name: ResponseLog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ResponseLog_id_seq" OWNED BY public."ResponseLog".id;


--
-- Name: SearchHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SearchHistory" (
    id integer NOT NULL,
    query text NOT NULL,
    category text,
    tags text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SearchHistory" OWNER TO postgres;

--
-- Name: SearchHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SearchHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SearchHistory_id_seq" OWNER TO postgres;

--
-- Name: SearchHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SearchHistory_id_seq" OWNED BY public."SearchHistory".id;


--
-- Name: SearchSynonym; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SearchSynonym" (
    id integer NOT NULL,
    word character varying(50) NOT NULL,
    synonym character varying(50) NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."SearchSynonym" OWNER TO postgres;

--
-- Name: SearchSynonym_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SearchSynonym_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SearchSynonym_id_seq" OWNER TO postgres;

--
-- Name: SearchSynonym_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SearchSynonym_id_seq" OWNED BY public."SearchSynonym".id;


--
-- Name: SeasonalInfo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SeasonalInfo" (
    id integer NOT NULL,
    info_type character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."SeasonalInfo" OWNER TO postgres;

--
-- Name: SeasonalInfo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."SeasonalInfo_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."SeasonalInfo_id_seq" OWNER TO postgres;

--
-- Name: SeasonalInfo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."SeasonalInfo_id_seq" OWNED BY public."SeasonalInfo".id;


--
-- Name: Tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Tag" (
    id integer NOT NULL,
    tag_name character varying(50) NOT NULL,
    description text
);


ALTER TABLE public."Tag" OWNER TO postgres;

--
-- Name: TagSynonym; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TagSynonym" (
    id integer NOT NULL,
    tag_id integer NOT NULL,
    synonym character varying(50) NOT NULL
);


ALTER TABLE public."TagSynonym" OWNER TO postgres;

--
-- Name: TagSynonym_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."TagSynonym_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."TagSynonym_id_seq" OWNER TO postgres;

--
-- Name: TagSynonym_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."TagSynonym_id_seq" OWNED BY public."TagSynonym".id;


--
-- Name: Tag_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Tag_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Tag_id_seq" OWNER TO postgres;

--
-- Name: Tag_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Tag_id_seq" OWNED BY public."Tag".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: AdminUser id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AdminUser" ALTER COLUMN id SET DEFAULT nextval('public."AdminUser_id_seq"'::regclass);


--
-- Name: AlertWord id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AlertWord" ALTER COLUMN id SET DEFAULT nextval('public."AlertWord_id_seq"'::regclass);


--
-- Name: Knowledge id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Knowledge" ALTER COLUMN id SET DEFAULT nextval('public."Knowledge_id_seq"'::regclass);


--
-- Name: KnowledgeQuestionVariation id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KnowledgeQuestionVariation" ALTER COLUMN id SET DEFAULT nextval('public."KnowledgeQuestionVariation_id_seq"'::regclass);


--
-- Name: ResponseLog id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ResponseLog" ALTER COLUMN id SET DEFAULT nextval('public."ResponseLog_id_seq"'::regclass);


--
-- Name: SearchHistory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SearchHistory" ALTER COLUMN id SET DEFAULT nextval('public."SearchHistory_id_seq"'::regclass);


--
-- Name: SearchSynonym id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SearchSynonym" ALTER COLUMN id SET DEFAULT nextval('public."SearchSynonym_id_seq"'::regclass);


--
-- Name: SeasonalInfo id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SeasonalInfo" ALTER COLUMN id SET DEFAULT nextval('public."SeasonalInfo_id_seq"'::regclass);


--
-- Name: Tag id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tag" ALTER COLUMN id SET DEFAULT nextval('public."Tag_id_seq"'::regclass);


--
-- Name: TagSynonym id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TagSynonym" ALTER COLUMN id SET DEFAULT nextval('public."TagSynonym_id_seq"'::regclass);


--
-- Data for Name: AdminUser; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AdminUser" (id, username, email, password_hash, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: AlertWord; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AlertWord" (id, word, description, related_tag_id, priority) FROM stdin;
\.


--
-- Data for Name: FeedbackWeight; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FeedbackWeight" (query_pattern, knowledge_id, weight, positive_count, negative_count, last_updated) FROM stdin;
\.


--
-- Data for Name: Knowledge; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Knowledge" (id, main_category, sub_category, detail_category, question, answer, is_template, usage, note, issue, "createdAt", "updatedAt", search_vector) FROM stdin;
1	利用の流れ	予約方法	ネット予約	予約方法を教えてください	メニューの「ご予約」ページからの24時間ネット予約のみとなります。電話、FAX、メールでのご予約は承っておりません。締切は利用日前日の22:00までです。	f	◯	ネット予約のみ対応	予約方法の明確化	2025-04-02 07:37:34.12	2025-04-02 07:37:34.12	'00までです':8A 'fax':5A 'ご予約':2A 'ネット予約':11B 'ネット予約のみ対応':13 'ページからの24時間ネット予約のみとなります':3A 'メニューの':1A 'メールでのご予約は承っておりません':6A '予約方法':10B '予約方法を教えてください':12C '利用の流れ':9B '締切は利用日前日の22':7A '電話':4A
2	利用の流れ	予約確認	完了画面	予約の完了はどうやって確認できますか？	1.予約完了画面の表示 2.予約受付メールの自動返信 のいずれかで確認できます。メールが来なくても、完了画面が表示されていれば予約は完了しています。	f	◯	完了画面が重要	予約完了確認の明確化	2025-04-02 07:37:34.411	2025-04-02 07:37:34.411	'1':1A '2':3A 'のいずれかで確認できます':5A 'メールが来なくても':6A '予約の完了はどうやって確認できますか':11C '予約受付メールの自動返信':4A '予約完了画面の表示':2A '予約確認':9B '利用の流れ':8B '完了画面':10B '完了画面が表示されていれば予約は完了しています':7A '完了画面が重要':12
3	利用の流れ	来場時	手順	当日の来場時の流れを教えてください	1.駐車場へ来場 2.受付 3.車両とカギのお預かり（※キーホルダー・家のカギは事前に取り外し） 4.空港まで無料送迎	f	◯	カギの付属品は事前に外す	来場時の流れ明確化	2025-04-02 07:37:34.418	2025-04-02 07:37:34.418	'1':1A '2':3A '3':5A '4':9A 'カギの付属品は事前に外す':15 'キーホルダー':7A '利用の流れ':11B '受付':4A '家のカギは事前に取り外し':8A '当日の来場時の流れを教えてください':14C '手順':13B '来場時':12B '空港まで無料送迎':10A '車両とカギのお預かり':6A '駐車場へ来場':2A
4	利用の流れ	帰着時	手順	帰着時（到着日）の流れを教えてください	1.空港到着後、荷物受取完了後に電話連絡 2.駐車場まで無料送迎 3.料金精算（現金のみ） 4.カギの返却	f	◯	携帯電話をオンにしておく	帰着時の流れ明確化	2025-04-02 07:37:34.422	2025-04-02 07:37:34.422	'1':1A '2':4A '3':6A '4':9A 'の流れを教えてください':16C 'カギの返却':10A '利用の流れ':11B '到着日':15C '帰着時':12B,14C '手順':13B '携帯電話をオンにしておく':17 '料金精算':7A '現金のみ':8A '空港到着後':2A '荷物受取完了後に電話連絡':3A '駐車場まで無料送迎':5A
5	利用の流れ	送迎時	注意点	送迎時の注意点はありますか？	1.ピーク時間や繁忙期はお迎えに時間がかかる場合があります 2.送迎車乗車までは携帯電話の電源を切らないでください	f	△	携帯電話が重要	送迎時の注意点明確化	2025-04-02 07:37:34.429	2025-04-02 07:37:34.429	'1':1A '2':3A 'ピーク時間や繁忙期はお迎えに時間がかかる場合があります':2A '利用の流れ':5B '携帯電話が重要':9 '注意点':7B '送迎時':6B '送迎時の注意点はありますか':8C '送迎車乗車までは携帯電話の電源を切らないでください':4A
6	利用の流れ	精算時	支払方法	精算時に必要なものはありますか？	現金のみでのお支払いとなります。カード決済は利用できません。	f	◯	現金のみ対応	精算方法の明確化	2025-04-02 07:37:34.433	2025-04-02 07:37:34.433	'カード決済は利用できません':2A '利用の流れ':3B '支払方法':5B '現金のみでのお支払いとなります':1A '現金のみ対応':7 '精算時':4B '精算時に必要なものはありますか':6C
7	利用の流れ	鍵管理	注意点	鍵の取り扱いで注意することは？	キーホルダーや家の鍵など、付属品の紛失・破損については責任を負いかねますので、事前に取り外してください。	f	◯	付属品の事前取り外し必須	鍵の取り扱い明確化	2025-04-02 07:37:34.437	2025-04-02 07:37:34.437	'キーホルダーや家の鍵など':1A '事前に取り外してください':4A '付属品の事前取り外し必須':9 '付属品の紛失':2A '利用の流れ':5B '注意点':7B '破損については責任を負いかねますので':3A '鍵の取り扱いで注意することは':8C '鍵管理':6B
8	利用の流れ	必要物	持ち物	利用時に必要な持ち物は？	1.運転免許証 2.予約時の電話番号が受信可能な携帯電話 3.精算用の現金	f	◯	携帯電話が必須	必要な持ち物明確化	2025-04-02 07:37:34.441	2025-04-02 07:37:34.441	'1':1A '2':3A '3':5A '予約時の電話番号が受信可能な携帯電話':4A '利用の流れ':7B '利用時に必要な持ち物は':10C '必要物':8B '持ち物':9B '携帯電話が必須':11 '精算用の現金':6A '運転免許証':2A
9	予約関連	予約条件	空き状況	予約したい日程に満車(×)の日が1日含まれています。空いている日だけ予約できますか？	予約期間中、すべての日程で空きが必要です。1日でも満車(×)の日が含まれる場合は予約できません。	f	✖️	希望日程をすべて空きのある日に変更してください	分割予約の問い合わせ防止	2025-04-02 07:37:34.444	2025-04-02 07:37:34.444	'1日でも満車':3A 'すべての日程で空きが必要です':2A 'の日が1日含まれています':9C 'の日が含まれる場合は予約できません':4A '予約したい日程に満車':8C '予約期間中':1A '予約条件':6B '予約関連':5B '希望日程をすべて空きのある日に変更してください':11 '空いている日だけ予約できますか':10C '空き状況':7B
10	予約関連	予約時間	夜間予約	22時以降の予約はできますか？	前日22時以降の予約は事務手数料2000円が追加となります。ただし、希望日程すべてに空き（○か△）がある場合のみ可能です。	f	△	22時以降の予約は追加料金が発生します	追加料金の事前告知	2025-04-02 07:37:34.449	2025-04-02 07:37:34.449	'22時以降の予約はできますか':9C '22時以降の予約は追加料金が発生します':10 'か':4A 'がある場合のみ可能です':5A 'ただし':2A '予約時間':7B '予約関連':6B '前日22時以降の予約は事務手数料2000円が追加となります':1A '夜間予約':8B '希望日程すべてに空き':3A
11	予約関連	予約条件	軽自動車	軽自動車の予約はカレンダーの満車に関係なく予約できますか？	21時以降に電話でのみ予約可能です。翌日分は21時から22時までの受付となります。	f	◯	21時以降のお電話でご確認ください	軽自動車枠の予約方法明確化	2025-04-02 07:37:34.452	2025-04-02 07:37:34.452	'21時以降に電話でのみ予約可能です':1A '21時以降のお電話でご確認ください':7 '予約条件':4B '予約関連':3B '翌日分は21時から22時までの受付となります':2A '軽自動車':5B '軽自動車の予約はカレンダーの満車に関係なく予約できますか':6C
12	予約関連	期間制限	繁忙期	繁忙期に予約を入れたいのですが制限はありますか？	繁忙期の期間は大型車と長期預かり割引プランの受入を停止しています	f	△	システム上予約できても実際は受入できない場合があります	繁忙期の予約制限明確化	2025-04-02 07:37:34.456	2025-04-02 07:37:34.456	'システム上予約できても実際は受入できない場合があります':6 '予約関連':2B '期間制限':3B '繁忙期':4B '繁忙期に予約を入れたいのですが制限はありますか':5C '繁忙期の期間は大型車と長期預かり割引プランの受入を停止しています':1A
13	予約関連	制限時間	来場制限	最終の送迎は何時までですか？	往路の最終来場時間は21:30までとなっております。	f	✖️	21:30以降の往路来場は不可	最終受付時間の明確化	2025-04-02 07:37:34.46	2025-04-02 07:37:34.46	'21':7 '30までとなっております':2A '30以降の往路来場は不可':8 '予約関連':3B '制限時間':4B '往路の最終来場時間は21':1A '最終の送迎は何時までですか':6C '来場制限':5B
14	予約関連	確認事項	基本条件	予約の前に確認すべき事項は何ですか？	以下の4点を必ずご確認ください：1. 国内線利用であること 2. 利用人数が往復とも5名以内 3. 車両が受入可能なサイズ・車種 4. 来場時間が21時30分までであること	f	◯	上記条件を満たさない場合は予約できません	予約可否の事前判断	2025-04-02 07:37:34.464	2025-04-02 07:37:34.464	'1':2A '2':4A '3':6A '4':9A '上記条件を満たさない場合は予約できません':15 '予約の前に確認すべき事項は何ですか':14C '予約関連':11B '以下の4点を必ずご確認ください':1A '利用人数が往復とも5名以内':5A '国内線利用であること':3A '基本条件':13B '来場時間が21時30分までであること':10A '確認事項':12B '車両が受入可能なサイズ':7A '車種':8A
15	予約関連	遅延対応	遅刻	遅刻しそうです。どうすればよいですか？	空港までは送迎いたしますが、搭乗手続きに間に合わない可能性がございます。必ず事前にご連絡ください。なお、搭乗手続きにつきましては、お客様ご自身での対応をお願いいたします。	f	△	出発時間の1時間前までのご来場を強く推奨	遅刻時の対応案内	2025-04-02 07:37:34.467	2025-04-02 07:37:34.467	'お客様ご自身での対応をお願いいたします':6A 'どうすればよいですか':11C 'なお':4A '予約関連':7B '出発時間の1時間前までのご来場を強く推奨':12 '必ず事前にご連絡ください':3A '搭乗手続きにつきましては':5A '搭乗手続きに間に合わない可能性がございます':2A '空港までは送迎いたしますが':1A '遅刻':9B '遅刻しそうです':10C '遅延対応':8B
16	予約関連	システム制限	自動判定	予約システムで受付可能でも実際は受入できないケースはありますか？	以下の場合はシステム上予約可能でも受入できません：1.繁忙期の大型車予約 2.長期割引プランの制限期間予約 3.サイズ制限超過車両 4.保険対象外車両	f	✖️	手動での確認と対応が必要です	システム制限の注意喚起	2025-04-02 07:37:34.471	2025-04-02 07:37:34.471	'1':2A '2':4A '3':6A '4':8A 'サイズ制限超過車両':7A 'システム制限':11B '予約システムで受付可能でも実際は受入できないケースはありますか':13C '予約関連':10B '以下の場合はシステム上予約可能でも受入できません':1A '保険対象外車両':9A '手動での確認と対応が必要です':14 '繁忙期の大型車予約':3A '自動判定':12B '長期割引プランの制限期間予約':5A
17	予約関連	複数予約	確認手順	複数台の予約はどのように確認すべきですか？	同一名義での複数台予約の場合：1.家族利用か確認 2.会社利用の場合は社名確認 3.グループ利用の場合は代表者確認 4.備考欄への記載確認	f	◯	複数台利用の意図を必ず確認	複数予約の適切な管理	2025-04-02 07:37:34.474	2025-04-02 07:37:34.474	'1':2A '2':4A '3':6A '4':8A 'グループ利用の場合は代表者確認':7A '予約関連':10B '会社利用の場合は社名確認':5A '備考欄への記載確認':9A '同一名義での複数台予約の場合':1A '家族利用か確認':3A '確認手順':12B '複数予約':11B '複数台の予約はどのように確認すべきですか':13C '複数台利用の意図を必ず確認':14
18	予約関連	トラブル対応	システム障害	システムトラブル時の対応手順は？	1.予約データの手動記録 2.お客様への状況説明 3.代替手段の案内 4.復旧後のデータ補完	f	△	お客様への迅速な情報提供	システムトラブルの影響最小化	2025-04-02 07:37:34.477	2025-04-02 07:37:34.477	'1':1A '2':3A '3':5A '4':7A 'お客様への状況説明':4A 'お客様への迅速な情報提供':13 'システムトラブル時の対応手順は':12C 'システム障害':11B 'トラブル対応':10B '予約データの手動記録':2A '予約関連':9B '代替手段の案内':6A '復旧後のデータ補完':8A
19	予約関連	繁忙期	受付基準	繁忙期の予約受付基準は？	1.大型車受入停止 2.長期割引プラン停止 3.一般予約は通常通り 4.軽自動車は電話予約可	f	△	システムでの自動制御なし	繁忙期対応の明確化	2025-04-02 07:37:34.48	2025-04-02 07:37:34.48	'1':1A '2':3A '3':5A '4':7A 'システムでの自動制御なし':13 '一般予約は通常通り':6A '予約関連':9B '受付基準':11B '大型車受入停止':2A '繁忙期':10B '繁忙期の予約受付基準は':12C '軽自動車は電話予約可':8A '長期割引プラン停止':4A
20	予約関連	トラブル対応	重複予約	同一予約者から複数の重複予約が入った場合の対応は？	以下の手順で対応します：1.予約者へ電話またはメールで連絡 2.複数予約のうち1つを本予約として確認 3.その他の予約をキャンセル（破棄） 4.予約サイトを閉じていただくようお願い	f	◯	ブラウザの戻るボタン操作等による誤送信が原因	同一予約者からの重複予約の適切な処理	2025-04-02 07:37:34.483	2025-04-02 07:37:34.483	'1':2A '2':4A '3':6A '4':9A 'その他の予約をキャンセル':7A 'トラブル対応':12B 'ブラウザの戻るボタン操作等による誤送信が原因':15 '予約サイトを閉じていただくようお願い':10A '予約者へ電話またはメールで連絡':3A '予約関連':11B '以下の手順で対応します':1A '同一予約者から複数の重複予約が入った場合の対応は':14C '破棄':8A '複数予約のうち1つを本予約として確認':5A '重複予約':13B
51	送迎関連	特別対応	車椅子	車椅子やベビーカーの送迎は可能ですか？	車椅子やベビーカーをご利用の場合は、必ず予約時の備考欄にご記入ください。	f	◯	事前申告が必要です	配慮が必要なお客様への対応案内	2025-04-02 07:37:34.587	2025-04-02 07:37:34.587	'事前申告が必要です':7 '必ず予約時の備考欄にご記入ください':2A '特別対応':4B '車椅子':5B '車椅子やベビーカーの送迎は可能ですか':6C '車椅子やベビーカーをご利用の場合は':1A '送迎関連':3B
21	予約関連	満車対応	軽自動車枠	満車の場合の予約対応方法は？	軽自動車の場合のみ、21時以降の電話予約で受付できる可能性があります。軽自動車用の特別枠を確保している場合があるためです。キャンセル待ちは一切受け付けていません。	f	△	21時以降の電話でのみ軽自動車の予約可能性あり	満車時の軽自動車受入対応	2025-04-02 07:37:34.487	2025-04-02 07:37:34.487	'21時以降の電話でのみ軽自動車の予約可能性あり':9 '21時以降の電話予約で受付できる可能性があります':2A 'キャンセル待ちは一切受け付けていません':4A '予約関連':5B '満車の場合の予約対応方法は':8C '満車対応':6B '軽自動車の場合のみ':1A '軽自動車枠':7B '軽自動車用の特別枠を確保している場合があるためです':3A
22	予約関連	システム管理	メンテナンス	システムメンテナンス時の予約受付方法は？	1.メンテナンス時間の告知 2.電話予約への切り替え 3.手書き記録の作成 4.システム復旧後のデータ入力	f	△	正確な情報管理の継続	システムメンテナンス時の対応	2025-04-02 07:37:34.49	2025-04-02 07:37:34.49	'1':1A '2':3A '3':5A '4':7A 'システムメンテナンス時の予約受付方法は':12C 'システム復旧後のデータ入力':8A 'システム管理':10B 'メンテナンス':11B 'メンテナンス時間の告知':2A '予約関連':9B '手書き記録の作成':6A '正確な情報管理の継続':13 '電話予約への切り替え':4A
23	予約関連	長期予約	確認事項	長期駐車の受入基準と確認事項は？	1.車両状態の確認 2.連絡先の複数確保 3.支払方法の確認 4.定期点検の実施	f	△	トラブル防止の事前確認	長期駐車の適切な管理	2025-04-02 07:37:34.493	2025-04-02 07:37:34.493	'1':1A '2':3A '3':5A '4':7A 'トラブル防止の事前確認':13 '予約関連':9B '定期点検の実施':8A '支払方法の確認':6A '確認事項':11B '車両状態の確認':2A '連絡先の複数確保':4A '長期予約':10B '長期駐車の受入基準と確認事項は':12C
24	予約関連	長期予約	注意事項	長期駐車の場合のバッテリー対応と注意事項は？	以下の説明と承諾確認を行います：1.バッテリー上がりの可能性があること 2.バッテリーを繋いでエンジンをかけること 3.カーナビなどの初期設定が飛ぶ可能性があること 4.上記内容の承諾確認	f	◯	バッテリー対応の承諾を必ず得る	長期駐車時のバッテリー対応の説明と承諾	2025-04-02 07:37:34.496	2025-04-02 07:37:34.496	'1':2A '2':4A '3':6A '4':8A 'カーナビなどの初期設定が飛ぶ可能性があること':7A 'バッテリーを繋いでエンジンをかけること':5A 'バッテリー上がりの可能性があること':3A 'バッテリー対応の承諾を必ず得る':14 '上記内容の承諾確認':9A '予約関連':10B '以下の説明と承諾確認を行います':1A '注意事項':12B '長期予約':11B '長期駐車の場合のバッテリー対応と注意事項は':13C
25	予約関連	システム通知	メール	メールが届かない場合はどうすればよいですか？	予約完了後すぐにメールが届きます。また予約完了画面が表示されます。メールが届かない場合は、迷惑メールフォルダの確認または受信制限の解除をお願いします。	f	◯	予約完了画面で予約内容の確認可能	予約確認手段の明確化	2025-04-02 07:37:34.502	2025-04-02 07:37:34.502	'また予約完了画面が表示されます':2A 'システム通知':6B 'メール':7B 'メールが届かない場合は':3A 'メールが届かない場合はどうすればよいですか':8C '予約完了後すぐにメールが届きます':1A '予約完了画面で予約内容の確認可能':9 '予約関連':5B '迷惑メールフォルダの確認または受信制限の解除をお願いします':4A
26	予約関連	割引プラン	コンパクト	コンパクトカー割引プランの条件は？	1.当社指定国産車AT限定 2.往復共2名様限定 3.他の割引との併用不可	f	◯	指定車種の確認必須	割引条件の明確化	2025-04-02 07:37:34.506	2025-04-02 07:37:34.506	'1':1A '2':3A '3':5A 'コンパクト':9B 'コンパクトカー割引プランの条件は':10C '予約関連':7B '他の割引との併用不可':6A '割引プラン':8B '当社指定国産車at限定':2A '往復共2名様限定':4A '指定車種の確認必須':11
27	予約関連	来場時間	前泊	前泊の場合の来場時間は？	21時30分までにご来場ください。	f	◯	時間厳守でお願いします	前泊時の来場時間明確化	2025-04-02 07:37:34.509	2025-04-02 07:37:34.509	'21時30分までにご来場ください':1A '予約関連':2B '前泊':4B '前泊の場合の来場時間は':5C '時間厳守でお願いします':6 '来場時間':3B
28	予約関連	利用目的	制限	国際線施設の利用目的での予約は可能ですか？	当駐車場は国内線ご利用のお客様専用となっております。見学・施設利用目的でもご利用いただけません。	f	✖️	国内線利用目的のみ受入可	利用目的の制限明確化	2025-04-02 07:37:34.512	2025-04-02 07:37:34.512	'予約関連':4B '利用目的':5B '制限':6B '国内線利用目的のみ受入可':8 '国際線施設の利用目的での予約は可能ですか':7C '当駐車場は国内線ご利用のお客様専用となっております':1A '施設利用目的でもご利用いただけません':3A '見学':2A
29	予約関連	キャンセル	欠航	飛行機が欠航になった場合はどうなりますか？	欠航の場合も、キャンセル料として料金の50%を申し受けます。	f	△	理由に関わらずキャンセル料金発生	欠航時の料金規定明確化	2025-04-02 07:37:34.514	2025-04-02 07:37:34.514	'を申し受けます':3A 'キャンセル':5B 'キャンセル料として料金の50':2A '予約関連':4B '欠航':6B '欠航の場合も':1A '理由に関わらずキャンセル料金発生':8 '飛行機が欠航になった場合はどうなりますか':7C
30	予約関連	日程変更	帰着日	帰着日の変更（早帰り）は可能ですか？	1.早めの連絡が必要（当日連絡は車の準備に時間が必要） 2.料金は来場時の表示金額を請求 3.延泊は1日毎の料金（ピーク該当日は加算）	f	△	車両準備の時間必要	帰着日変更の適切な対応	2025-04-02 07:37:34.518	2025-04-02 07:37:34.518	'1':1A '2':4A '3':6A 'は可能ですか':14C 'ピーク該当日は加算':8A '予約関連':9B '帰着日':11B '帰着日の変更':12C '延泊は1日毎の料金':7A '当日連絡は車の準備に時間が必要':3A '料金は来場時の表示金額を請求':5A '日程変更':10B '早めの連絡が必要':2A '早帰り':13C '車両準備の時間必要':15
73	料金関連	追加料金	案内手順	追加料金発生時の案内方法は？	1.発生理由の説明 2.金額の明示 3.支払方法の案内 4.領収書対応の説明	f	◯	事前説明でトラブル防止	追加料金の適切な案内	2025-04-02 07:37:34.642	2025-04-02 07:37:34.642	'1':1A '2':3A '3':5A '4':7A '事前説明でトラブル防止':13 '支払方法の案内':6A '料金関連':9B '案内手順':11B '発生理由の説明':2A '追加料金':10B '追加料金発生時の案内方法は':12C '金額の明示':4A '領収書対応の説明':8A
31	予約関連	日程変更	帰着日	帰着日の変更（早帰り・延泊）はどうすればいいですか？	1.早帰りの場合は早めのご連絡が必要（車の準備に時間がかかるため） 2.当日連絡の場合は車の準備でお待たせする可能性あり 3.延泊は1日毎の料金請求（ピーク該当日は料金加算）	f	△	早めの連絡が重要	帰着日変更の手続き明確化	2025-04-02 07:37:34.521	2025-04-02 07:37:34.521	'1':1A '2':4A '3':6A 'はどうすればいいですか':15C 'ピーク該当日は料金加算':8A '予約関連':9B '帰着日':11B '帰着日の変更':12C '延泊':14C '延泊は1日毎の料金請求':7A '当日連絡の場合は車の準備でお待たせする可能性あり':5A '日程変更':10B '早めの連絡が重要':16 '早帰り':13C '早帰りの場合は早めのご連絡が必要':2A '車の準備に時間がかかるため':3A
32	予約関連	時間変更	連絡方法	フライト時間の変更や遅延はどうすればいいですか？	フライトの変更や遅延が分かった時点でご連絡ください。24:00以降の到着は追加料金2000円で24:30までお迎え対応可能です。	f	△	早めの連絡必要	フライト変更時の対応明確化	2025-04-02 07:37:34.526	2025-04-02 07:37:34.526	'00以降の到着は追加料金2000円で24':3A '24':2A '30までお迎え対応可能です':4A 'フライトの変更や遅延が分かった時点でご連絡ください':1A 'フライト時間の変更や遅延はどうすればいいですか':8C '予約関連':5B '早めの連絡必要':9 '時間変更':6B '連絡方法':7B
33	車両関連	車両情報	車種	車種はどのように記入すればよいですか？	ブランド名と車名を記入してください。例：ホンダ Nボックス、トヨタ タンク	f	◯	スペースを入れてブランド名と車名を記入	車種情報の正確な記録	2025-04-02 07:37:34.529	2025-04-02 07:37:34.529	'nボックス':4A 'スペースを入れてブランド名と車名を記入':11 'タンク':6A 'トヨタ':5A 'ブランド名と車名を記入してください':1A 'ホンダ':3A '例':2A '車両情報':8B '車両関連':7B '車種':9B '車種はどのように記入すればよいですか':10C
34	車両関連	サイズ制限	高さ制限	ルーフキャリアを装着していますが、通常の予約でよいですか？	車両の高さがキャリアを含めて1.95m以上になる場合は、大型車プランでの予約が必要です。特に軽自動車は要注意です。	f	△	当日、高さ制限オーバーが判明した場合は大型車料金となります	サイズ超過の事前防止	2025-04-02 07:37:34.532	2025-04-02 07:37:34.532	'サイズ制限':6B 'ルーフキャリアを装着していますが':8C '以上になる場合は':2A '大型車プランでの予約が必要です':3A '当日':10 '特に軽自動車は要注意です':4A '車両の高さがキャリアを含めて1.95m':1A '車両関連':5B '通常の予約でよいですか':9C '高さ制限':7B '高さ制限オーバーが判明した場合は大型車料金となります':11
35	車両関連	車種制限	レクサス	レクサスで利用したいのですが？	レクサスは場内保険の対象外となるため、お預かりできかねます。	f	✖️	場内保険の対象外である事実を明記	レクサス利用の問い合わせ対応	2025-04-02 07:37:34.536	2025-04-02 07:37:34.536	'お預かりできかねます':2A 'レクサス':5B 'レクサスで利用したいのですが':6C 'レクサスは場内保険の対象外となるため':1A '場内保険の対象外である事実を明記':7 '車両関連':3B '車種制限':4B
36	車両関連	サイズ確認	確認手順	車両サイズの確認はどのように行いますか？	1.メーカー・車種から標準サイズ確認 2.キャリア等の装着物確認 3.改造の有無確認 4.実測値と申告値の照合	f	◯	サイズ超過の事前防止	車両制限の確実な実施	2025-04-02 07:37:34.54	2025-04-02 07:37:34.54	'1':1A '2':4A '3':6A '4':8A 'キャリア等の装着物確認':5A 'サイズ確認':11B 'サイズ超過の事前防止':14 'メーカー':2A '実測値と申告値の照合':9A '改造の有無確認':7A '確認手順':12B '車両サイズの確認はどのように行いますか':13C '車両関連':10B '車種から標準サイズ確認':3A
37	車両関連	確認手順	現場確認	来場時に申告と異なる車両での来場があった場合は？	1.受入可否の即時判断 2.車両情報の記録 3.追加料金の説明 4.受入不可の場合の代替案内	f	△	事前申告との相違確認	車両変更時の適切な対応	2025-04-02 07:37:34.543	2025-04-02 07:37:34.543	'1':1A '2':3A '3':5A '4':7A '事前申告との相違確認':13 '受入不可の場合の代替案内':8A '受入可否の即時判断':2A '来場時に申告と異なる車両での来場があった場合は':12C '現場確認':11B '確認手順':10B '車両情報の記録':4A '車両関連':9B '追加料金の説明':6A
38	車両関連	トラブル対応	車両損傷	車両損傷が発見された場合の対応手順は？	1.損傷状況の記録（写真） 2.お客様への確認 3.保険対応の説明 4.事故報告書の作成	f	△	事実確認を慎重に行う	車両損傷時の適切な対応	2025-04-02 07:37:34.546	2025-04-02 07:37:34.546	'1':1A '2':4A '3':6A '4':8A 'お客様への確認':5A 'トラブル対応':11B '事実確認を慎重に行う':14 '事故報告書の作成':9A '保険対応の説明':7A '写真':3A '損傷状況の記録':2A '車両損傷':12B '車両損傷が発見された場合の対応手順は':13C '車両関連':10B
39	車両関連	サイズ制限	高さ制限	キャリアやルーフボックスの高さ制限は？	軽自動車・普通車を問わず、キャリア・ルーフボックスを含めて高さ1.95m以上の場合は大型車料金となります。事前申告が必要です。	f	△	全車種に高さ制限適用	車両サイズの適切な把握	2025-04-02 07:37:34.548	2025-04-02 07:37:34.548	'キャリア':3A 'キャリアやルーフボックスの高さ制限は':10C 'サイズ制限':8B 'ルーフボックスを含めて高さ1.95m':4A '事前申告が必要です':6A '以上の場合は大型車料金となります':5A '全車種に高さ制限適用':11 '普通車を問わず':2A '車両関連':7B '軽自動車':1A '高さ制限':9B
40	車両関連	車種制限	指定車種	指定国産車とはどのような車種ですか？	レクサス全車種、FJクルーザー、ハイラックス、ランドクルーザー、プラド、グランドキャビン、キャラバン・ハイエース（ワイド、ハイルーフ）、パジェロ、プレジデント、グランエース等は受入不可	f	✖️	年式問わず受入不可	受入不可車両の明確化	2025-04-02 07:37:34.553	2025-04-02 07:37:34.553	'fjクルーザー':2A 'キャラバン':7A 'グランエース等は受入不可':13A 'グランドキャビン':6A 'ハイエース':8A 'ハイラックス':3A 'ハイルーフ':10A 'パジェロ':11A 'プラド':5A 'プレジデント':12A 'ランドクルーザー':4A 'レクサス全車種':1A 'ワイド':9A '年式問わず受入不可':18 '指定国産車とはどのような車種ですか':17C '指定車種':16B '車両関連':14B '車種制限':15B
41	車両関連	車種制限	受入不可	マニュアル車、土禁車、改造車は利用できますか？	申し訳ございませんが、以下の車両は受入できません：1.マニュアル車 2.土禁車 3.改造車 4.社外バンパーやヒッチメンバー装着車	f	✖️	一切の例外なく受入不可	受入不可車両の明確化	2025-04-02 07:37:34.556	2025-04-02 07:37:34.556	'1':3A '2':5A '3':7A '4':9A 'マニュアル車':4A,14C '一切の例外なく受入不可':17 '以下の車両は受入できません':2A '受入不可':13B '土禁車':6A,15C '改造車':8A '改造車は利用できますか':16C '申し訳ございませんが':1A '社外バンパーやヒッチメンバー装着車':10A '車両関連':11B '車種制限':12B
42	車両関連	鍵管理	預かり	車の鍵の取り扱いについて注意点は？	1.車の鍵はお預かり必須（スマートキーのメカニカルキー取り外し禁止） 2.他の鍵やキーホルダーは事前に取り外し 3.鍵の持ち去り・預け忘れは罰金5000円	f	◯	業務上必要な鍵の管理	鍵の適切な管理	2025-04-02 07:37:34.559	2025-04-02 07:37:34.559	'1':1A '2':4A '3':6A 'スマートキーのメカニカルキー取り外し禁止':3A '他の鍵やキーホルダーは事前に取り外し':5A '業務上必要な鍵の管理':13 '車の鍵の取り扱いについて注意点は':12C '車の鍵はお預かり必須':2A '車両関連':9B '鍵の持ち去り':7A '鍵管理':10B '預かり':11B '預け忘れは罰金5000円':8A
43	車両関連	サイズ制限	大型車	大型車両の料金と注意点は？	1.規定サイズ超過（高さ1.95m～・幅1.85m～・長さ5.05m～）は大型料金（+1日1000円） 2.キャリア等も高さに含む 3.大型枠には限りあり 4.サイズ超過車は当日でも大型料金	f	△	予約可能でも受入できない場合あり	大型車両の取扱明確化	2025-04-02 07:37:34.562	2025-04-02 07:37:34.562	'+1':7A '1':1A '2':9A '3':11A '4':13A 'は大型料金':6A 'キャリア等も高さに含む':10A 'サイズ制限':16B 'サイズ超過車は当日でも大型料金':14A '予約可能でも受入できない場合あり':19 '大型枠には限りあり':12A '大型車':17B '大型車両の料金と注意点は':18C '幅1.85m':4A '日1000円':8A '規定サイズ超過':2A '車両関連':15B '長さ5.05m':5A '高さ1.95m':3A
44	車両関連	駐車環境	汚れ	駐車場での車両の汚れについて	1.首都高速湾岸線下のため、雨・風・ほこり等自然発生の汚れは防げません 2.土禁車は受付不可 3.駐車場所の指定不可	f	◯	自然発生の汚れについて免責	駐車環境の説明	2025-04-02 07:37:34.565	2025-04-02 07:37:34.565	'1':1A '2':6A '3':8A 'ほこり等自然発生の汚れは防げません':5A '土禁車は受付不可':7A '汚れ':12B '自然発生の汚れについて免責':14 '車両関連':10B '雨':3A '風':4A '首都高速湾岸線下のため':2A '駐車場での車両の汚れについて':13C '駐車場所の指定不可':9A '駐車環境':11B
45	車両関連	受入基準	制限	サイズオーバーや改造車の受入は？	サイズオーバー、改造車など、お預かりできないと判断した車両はお断りさせていただきます。	f	✖️	受入可否は当社判断	受入基準の明確化	2025-04-02 07:37:34.568	2025-04-02 07:37:34.568	'お預かりできないと判断した車両はお断りさせていただきます':3A 'サイズオーバー':1A 'サイズオーバーや改造車の受入は':7C '制限':6B '受入可否は当社判断':8 '受入基準':5B '改造車など':2A '車両関連':4B
46	送迎関連	時間	来場時間	来場時間はどのように設定すればよいですか？	羽田空港出発時間の1時間前までにご来場ください。ただし最終来場受付は21時30分までです。	f	◯	搭乗手続きに間に合わない可能性があるため、時間厳守でお願いします	適切な来場時間の確保	2025-04-02 07:37:34.571	2025-04-02 07:37:34.571	'ただし最終来場受付は21時30分までです':2A '搭乗手続きに間に合わない可能性があるため':7 '時間':4B '時間厳守でお願いします':8 '来場時間':5B '来場時間はどのように設定すればよいですか':6C '羽田空港出発時間の1時間前までにご来場ください':1A '送迎関連':3B
47	送迎関連	時間	所要時間	送迎の所要時間はどのくらいですか？	当駐車場から空港まで5〜10分程度です。出発搭乗時間の1時間前までにご来場ください。	f	◯	搭乗手続きに間に合うよう時間厳守でお願いします	適切な来場時間の案内	2025-04-02 07:37:34.574	2025-04-02 07:37:34.574	'10分程度です':2A '出発搭乗時間の1時間前までにご来場ください':3A '当駐車場から空港まで5':1A '所要時間':6B '搭乗手続きに間に合うよう時間厳守でお願いします':8 '時間':5B '送迎の所要時間はどのくらいですか':7C '送迎関連':4B
48	送迎関連	制限事項	大きな荷物	大きな荷物がある場合の送迎は可能ですか？	スーツケースやゴルフバッグなど、大きな荷物をお持ちの場合は、必ず予約時の備考欄にご記入ください。・ゴルフバッグは1台につき2つまで・スキー板やボード類は運搬不可	f	△	荷物制限を超える場合は対応できません	大きな荷物の制限事項の明確化	2025-04-02 07:37:34.578	2025-04-02 07:37:34.578	'ゴルフバッグは1台につき2つまで':4A 'スキー板やボード類は運搬不可':5A 'スーツケースやゴルフバッグなど':1A '制限事項':7B '大きな荷物':8B '大きな荷物がある場合の送迎は可能ですか':9C '大きな荷物をお持ちの場合は':2A '必ず予約時の備考欄にご記入ください':3A '荷物制限を超える場合は対応できません':10 '送迎関連':6B
49	送迎関連	時間	遅延対応	到着便が遅延した場合の対応は？	事前申告が必要です。24:00以降の到着便は2000円の追加料金で24:30までお迎え対応が可能です。到着後お電話をいただければ指定の乗り場までお迎えに参ります。（24:30以降の到着は翌朝５時～のお迎えとなります。）	f	△	24:30以降は対応不可	遅延時の対応案内	2025-04-02 07:37:34.581	2025-04-02 07:37:34.581	'00以降の到着便は2000円の追加料金で24':3A '24':2A,6A,13 '30までお迎え対応が可能です':4A '30以降の到着は翌朝５時':7A '30以降は対応不可':14 'のお迎えとなります':8A '事前申告が必要です':1A '到着便が遅延した場合の対応は':12C '到着後お電話をいただければ指定の乗り場までお迎えに参ります':5A '時間':10B '送迎関連':9B '遅延対応':11B
50	送迎関連	制限事項	ペット	ペットの送迎は可能ですか？	申し訳ございませんが、ペットの送迎は承っておりません。	f	✖️	送迎車両でのペット移動は不可	ペット送迎不可の明確な案内	2025-04-02 07:37:34.584	2025-04-02 07:37:34.584	'ペット':5B 'ペットの送迎は可能ですか':6C 'ペットの送迎は承っておりません':2A '制限事項':4B '申し訳ございませんが':1A '送迎車両でのペット移動は不可':7 '送迎関連':3B
52	送迎関連	案内	乗り場	送迎時の乗り場はどこですか？	往路は当駐車場から空港までご案内いたします。帰りは到着後、お手荷物を受け取られましたら、お電話をいただければ指定の乗り場までお迎えに参ります。	f	◯	電話連絡時に乗り場をご案内	送迎の流れの案内	2025-04-02 07:37:34.59	2025-04-02 07:37:34.59	'お手荷物を受け取られましたら':3A 'お電話をいただければ指定の乗り場までお迎えに参ります':4A '乗り場':7B '帰りは到着後':2A '往路は当駐車場から空港までご案内いたします':1A '案内':6B '送迎時の乗り場はどこですか':8C '送迎関連':5B '電話連絡時に乗り場をご案内':9
53	送迎関連	待ち時間	混雑	送迎時の待ち時間はありますか？	当駐車場は個別送迎ではないため、お客様の帰着が重なる場合や交通渋滞、道路工事などでお迎えまでお時間をいただくことがございます。お急ぎの場合は、タクシーでお戻りいただくことも可能です。	f	△	送迎車ご利用の場合は携帯電話を常時オンにしてください	送迎待ち時間の案内	2025-04-02 07:37:34.593	2025-04-02 07:37:34.593	'お客様の帰着が重なる場合や交通渋滞':2A 'お急ぎの場合は':4A 'タクシーでお戻りいただくことも可能です':5A '当駐車場は個別送迎ではないため':1A '待ち時間':7B '混雑':8B '送迎時の待ち時間はありますか':9C '送迎車ご利用の場合は携帯電話を常時オンにしてください':10 '送迎関連':6B '道路工事などでお迎えまでお時間をいただくことがございます':3A
54	送迎関連	配車管理	注意点	送迎車の配車で注意すべき点は？	1.来場時間の集中確認 2.大きな荷物の有無 3.車椅子等の特別対応 4.深夜便の有無 5.配車数の調整	f	△	配車効率と顧客満足度の両立	送迎車の効率的な運用	2025-04-02 07:37:34.595	2025-04-02 07:37:34.595	'1':1A '2':3A '3':5A '4':7A '5':9A '大きな荷物の有無':4A '来場時間の集中確認':2A '注意点':13B '深夜便の有無':8A '車椅子等の特別対応':6A '送迎車の配車で注意すべき点は':14C '送迎関連':11B '配車効率と顧客満足度の両立':15 '配車数の調整':10A '配車管理':12B
55	送迎関連	深夜対応	基準	深夜送迎の受付基準は？	1.24時までの到着便のみ対応 2.追加料金2000円必要 3.24:30までに送迎完了 4.事前連絡必須	f	△	時間超過は対応不可	深夜対応の明確化	2025-04-02 07:37:34.597	2025-04-02 07:37:34.597	'1.24':1A '2':3A '3.24':5A '30までに送迎完了':6A '4':7A '事前連絡必須':8A '基準':11B '時までの到着便のみ対応':2A '時間超過は対応不可':13 '深夜対応':10B '深夜送迎の受付基準は':12C '追加料金2000円必要':4A '送迎関連':9B
56	送迎関連	トラブル対応	手順	送迎トラブル発生時の対応手順は？	1.状況確認と記録 2.お客様への説明 3.代替手段の案内 4.上長への報告	f	△	お客様の安全確保優先	送迎トラブルの適切な対応	2025-04-02 07:37:34.599	2025-04-02 07:37:34.599	'1':1A '2':3A '3':5A '4':7A 'お客様の安全確保優先':13 'お客様への説明':4A 'トラブル対応':10B '上長への報告':8A '代替手段の案内':6A '手順':11B '状況確認と記録':2A '送迎トラブル発生時の対応手順は':12C '送迎関連':9B
57	送迎関連	特別対応	悪天候	悪天候時の送迎対応の判断基準は？	1.気象情報の確認 2.空港の運航状況確認 3.道路状況の確認 4.送迎頻度の調整 5.お客様への案内	f	△	安全を最優先した判断	悪天候時の安全確保	2025-04-02 07:37:34.602	2025-04-02 07:37:34.602	'1':1A '2':3A '3':5A '4':7A '5':9A 'お客様への案内':10A '安全を最優先した判断':15 '悪天候':13B '悪天候時の送迎対応の判断基準は':14C '気象情報の確認':2A '特別対応':12B '空港の運航状況確認':4A '送迎関連':11B '送迎頻度の調整':8A '道路状況の確認':6A
58	送迎関連	案内変更	待機場所	送迎車の待機場所変更時の対応は？	1.案内の変更 2.お客様への連絡 3.スタッフ間の情報共有 4.混乱防止の導線確保	f	◯	お客様の混乱防止	待機場所変更時の混乱防止	2025-04-02 07:37:34.605	2025-04-02 07:37:34.605	'1':1A '2':3A '3':5A '4':7A 'お客様の混乱防止':13 'お客様への連絡':4A 'スタッフ間の情報共有':6A '待機場所':11B '案内の変更':2A '案内変更':10B '混乱防止の導線確保':8A '送迎車の待機場所変更時の対応は':12C '送迎関連':9B
59	送迎関連	忘れ物対応	手順	送迎時の忘れ物対応手順は？	1.発見時の記録作成 2.お客様への連絡 3.保管場所の管理 4.お届けの場合は別途1000円が必要な旨を説明 5.お渡し方法の案内と料金の確認	f	◯	お届けは別途1000円必要	忘れ物の適切な管理と配達対応	2025-04-02 07:37:34.608	2025-04-02 07:37:34.608	'1':1A '2':3A '3':5A '4':7A '5':9A 'お客様への連絡':4A 'お届けの場合は別途1000円が必要な旨を説明':8A 'お届けは別途1000円必要':15 'お渡し方法の案内と料金の確認':10A '保管場所の管理':6A '忘れ物対応':12B '手順':13B '発見時の記録作成':2A '送迎時の忘れ物対応手順は':14C '送迎関連':11B
60	送迎関連	運行管理	スケジュール	送迎スケジュール調整の基準は？	1.時間帯別の予約状況確認 2.車両配備計画の作成 3.スタッフ配置の調整 4.余裕時間の確保	f	◯	効率的な配車の実現	送迎業務の最適化	2025-04-02 07:37:34.61	2025-04-02 07:37:34.61	'1':1A '2':3A '3':5A '4':7A 'スケジュール':11B 'スタッフ配置の調整':6A '余裕時間の確保':8A '効率的な配車の実現':13 '時間帯別の予約状況確認':2A '車両配備計画の作成':4A '送迎スケジュール調整の基準は':12C '送迎関連':9B '運行管理':10B
61	送迎関連	緊急対応	中止判断	緊急時の送迎中止判断基準は？	1.気象警報の確認 2.道路状況の確認 3.空港運営状況の確認 4.代替手段の案内	f	✖️	安全確保を最優先	緊急時の適切な判断	2025-04-02 07:37:34.613	2025-04-02 07:37:34.613	'1':1A '2':3A '3':5A '4':7A '中止判断':11B '代替手段の案内':8A '安全確保を最優先':13 '気象警報の確認':2A '空港運営状況の確認':6A '緊急対応':10B '緊急時の送迎中止判断基準は':12C '送迎関連':9B '道路状況の確認':4A
62	送迎関連	制限事項	定員	送迎車の乗車定員は何名ですか？	予約車1台につき往復とも5名様までとなっております。大きな荷物がある場合は要事前申告です。	f	◯	1台あたり5名様まで	送迎定員の明確化	2025-04-02 07:37:34.615	2025-04-02 07:37:34.615	'1台あたり5名様まで':7 '予約車1台につき往復とも5名様までとなっております':1A '制限事項':4B '大きな荷物がある場合は要事前申告です':2A '定員':5B '送迎車の乗車定員は何名ですか':6C '送迎関連':3B
63	送迎関連	制限事項	人数制限	送迎人数の制限について詳しく教えてください	送迎車が10人乗りのため、1台のご予約につきお子様（幼児）含む5名様までとさせていただいております。他のお客様とのトラブル回避のためご協力ください。	f	◯	幼児含む5名まで	送迎人数の明確化	2025-04-02 07:37:34.617	2025-04-02 07:37:34.617	'1台のご予約につきお子様':2A '人数制限':8B '他のお客様とのトラブル回避のためご協力ください':5A '制限事項':7B '含む5名様までとさせていただいております':4A '幼児':3A '幼児含む5名まで':10 '送迎人数の制限について詳しく教えてください':9C '送迎車が10人乗りのため':1A '送迎関連':6B
64	送迎関連	所要時間	目安	送迎の所要時間と来場時間の目安は？	送迎は基本的に相乗りです。当駐車場から空港まで5〜10分程度。飛行機出発時間の1時間前（国内線）、ツアー集合時間30分前までにご来場ください。	f	◯	出発時間から逆算して来場	適切な来場時間の案内	2025-04-02 07:37:34.62	2025-04-02 07:37:34.62	'10分程度':3A 'ツアー集合時間30分前までにご来場ください':6A '出発時間から逆算して来場':11 '国内線':5A '当駐車場から空港まで5':2A '所要時間':8B '目安':9B '送迎の所要時間と来場時間の目安は':10C '送迎は基本的に相乗りです':1A '送迎関連':7B '飛行機出発時間の1時間前':4A
65	送迎関連	案内方法	小冊子	帰りの送迎場所はどうやって確認できますか？	行きの送迎時に、連絡先と迎え場所など注意事項を記載した小冊子をお渡しします。	f	◯	小冊子で案内を確認	送迎場所の案内方法明確化	2025-04-02 07:37:34.622	2025-04-02 07:37:34.622	'小冊子':5B '小冊子で案内を確認':7 '帰りの送迎場所はどうやって確認できますか':6C '案内方法':4B '行きの送迎時に':1A '送迎関連':3B '連絡先と迎え場所など注意事項を記載した小冊子をお渡しします':2A
66	送迎関連	設備	荷物置場	送迎車は荷物をどこに置けますか？	送迎車はハイエースを使用しています。専用のトランクなどはございませんが、後部座席の後ろに荷物を置くスペースがございます。ご利用の際はスタッフへお声がけください。	f	◯	後部座席後ろに荷物置場あり	送迎車設備の説明	2025-04-02 07:37:34.624	2025-04-02 07:37:34.624	'ご利用の際はスタッフへお声がけください':4A '専用のトランクなどはございませんが':2A '後部座席の後ろに荷物を置くスペースがございます':3A '後部座席後ろに荷物置場あり':9 '荷物置場':7B '設備':6B '送迎車はハイエースを使用しています':1A '送迎車は荷物をどこに置けますか':8C '送迎関連':5B
67	料金関連	割引	プラン併用	割引プランは併用できますか？	すべての割引プランは併用不可です。各プランとも割引額は1日100円です。条件を満たすプランをいずれか1つお選びください。	f	◯	長期割引プランは繁忙期利用不可	割引プラン併用の問い合わせ防止	2025-04-02 07:37:34.627	2025-04-02 07:37:34.627	'すべての割引プランは併用不可です':1A 'プラン併用':6B '割引':5B '割引プランは併用できますか':7C '各プランとも割引額は1日100円です':2A '料金関連':4B '条件を満たすプランをいずれか1つお選びください':3A '長期割引プランは繁忙期利用不可':8
68	料金関連	支払時期	精算時	追加料金（深夜料金など）はいつ支払いますか？	追加料金は精算時にお支払いください。24:00以降の到着便の場合は2000円の深夜料金が発生いたします。	f	◯	精算は現金のみ	追加料金の支払い案内	2025-04-02 07:37:34.629	2025-04-02 07:37:34.629	'00以降の到着便の場合は2000円の深夜料金が発生いたします':3A '24':2A 'はいつ支払いますか':9C '支払時期':5B '料金関連':4B '深夜料金など':8C '精算は現金のみ':10 '精算時':6B '追加料金':7C '追加料金は精算時にお支払いください':1A
69	料金関連	領収書	発行	領収書は発行できますか？	はい、領収書を発行いたします。宛名等のご指定がある場合は、予約時に備考欄へご記入ください。飛行機の遅延による深夜料金（2000円）の場合も領収書を発行いたしますので、航空会社への払い戻し申請にご利用ください。	f	◯	遅延時の領収書は航空会社への払い戻し申請が可能	領収書発行の案内・遅延時の費用返還対応	2025-04-02 07:37:34.632	2025-04-02 07:37:34.632	'2000円':6A 'の場合も領収書を発行いたしますので':7A 'はい':1A '予約時に備考欄へご記入ください':4A '宛名等のご指定がある場合は':3A '料金関連':9B '発行':11B '航空会社への払い戻し申請にご利用ください':8A '遅延時の領収書は航空会社への払い戻し申請が可能':13 '領収書':10B '領収書は発行できますか':12C '領収書を発行いたします':2A '飛行機の遅延による深夜料金':5A
70	料金関連	キャンセル料	当日	当日キャンセルの場合はどうなりますか？	当日キャンセルの場合、キャンセル料として料金の50%を申し受けます。振込先を別途メールにてご案内いたします。	f	△	キャンセル料は振込対応のみ	当日キャンセル時の案内	2025-04-02 07:37:34.635	2025-04-02 07:37:34.635	'を申し受けます':3A 'キャンセル料':6B 'キャンセル料として料金の50':2A 'キャンセル料は振込対応のみ':9 '当日':7B '当日キャンセルの場合':1A '当日キャンセルの場合はどうなりますか':8C '振込先を別途メールにてご案内いたします':4A '料金関連':5B
71	料金関連	支払方法	現金	支払い方法は何が使えますか？	お支払いは現金のみとなっております。	f	◯	カード利用不可	支払方法の案内	2025-04-02 07:37:34.637	2025-04-02 07:37:34.637	'お支払いは現金のみとなっております':1A 'カード利用不可':6 '支払い方法は何が使えますか':5C '支払方法':3B '料金関連':2B '現金':4B
72	料金関連	領収書	発行手順	領収書発行時の注意点は？	1.宛名の確認（個人/法人） 2.但し書きの確認 3.追加料金の明記 4.遅延による追加料金は別領収書	f	◯	航空会社への払戻対応考慮	領収書の適切な発行	2025-04-02 07:37:34.639	2025-04-02 07:37:34.639	'1':1A '2':5A '3':7A '4':9A '但し書きの確認':6A '個人':3A '宛名の確認':2A '料金関連':11B '法人':4A '発行手順':13B '航空会社への払戻対応考慮':15 '追加料金の明記':8A '遅延による追加料金は別領収書':10A '領収書':12B '領収書発行時の注意点は':14C
74	料金関連	トラブル対応	精算時	精算時のトラブル対応手順は？	1.料金内訳の明示 2.追加料金の説明 3.領収書の確認 4.苦情時は上長対応	f	△	丁寧な説明を心がける	精算トラブルの防止	2025-04-02 07:37:34.644	2025-04-02 07:37:34.644	'1':1A '2':3A '3':5A '4':7A 'トラブル対応':10B '丁寧な説明を心がける':13 '料金内訳の明示':2A '料金関連':9B '精算時':11B '精算時のトラブル対応手順は':12C '苦情時は上長対応':8A '追加料金の説明':4A '領収書の確認':6A
75	料金関連	料金改定	対応手順	料金改定時の対応手順は？	1.改定情報の告知 2.予約済み案件の確認 3.システム料金の更新 4.スタッフへの周知	f	◯	混乱防止の事前対応	料金改定時の適切な対応	2025-04-02 07:37:34.646	2025-04-02 07:37:34.646	'1':1A '2':3A '3':5A '4':7A 'システム料金の更新':6A 'スタッフへの周知':8A '予約済み案件の確認':4A '対応手順':11B '改定情報の告知':2A '料金改定':10B '料金改定時の対応手順は':12C '料金関連':9B '混乱防止の事前対応':13
76	料金関連	団体予約	計算方法	団体予約の料金計算方法は？	1.車両台数の確認 2.割引プランの適用確認 3.追加オプションの集計 4.一括精算か個別精算かの確認	f	◯	正確な料金計算の実施	団体予約の適切な管理	2025-04-02 07:37:34.649	2025-04-02 07:37:34.649	'1':1A '2':3A '3':5A '4':7A '一括精算か個別精算かの確認':8A '割引プランの適用確認':4A '団体予約':10B '団体予約の料金計算方法は':12C '料金関連':9B '正確な料金計算の実施':13 '計算方法':11B '車両台数の確認':2A '追加オプションの集計':6A
77	料金関連	追加料金	忘れ物配達	忘れ物のお届けにかかる料金は？	ご送迎後のお忘れ物のお届けは、別途1000円を申し受けます。	f	◯	配達料金は現金でお支払いください	忘れ物配達料金の明確化	2025-04-02 07:37:34.652	2025-04-02 07:37:34.652	'ご送迎後のお忘れ物のお届けは':1A '別途1000円を申し受けます':2A '忘れ物のお届けにかかる料金は':6C '忘れ物配達':5B '料金関連':3B '追加料金':4B '配達料金は現金でお支払いください':7
78	料金関連	支払方法	現金	現金以外の支払い方法はありますか？	申し訳ございませんが、お支払いは現金のみとなっております。カード決済は利用できません。	f	✖️	現金のみ対応可能	支払方法の明確化	2025-04-02 07:37:34.655	2025-04-02 07:37:34.655	'お支払いは現金のみとなっております':2A 'カード決済は利用できません':3A '支払方法':5B '料金関連':4B '現金':6B '現金のみ対応可能':8 '現金以外の支払い方法はありますか':7C '申し訳ございませんが':1A
79	料金関連	支払方法	現金精算	支払方法と精算タイミングは？	お預かりした鍵の返却時に、現金にて精算となります。カード決済は利用できません。	f	◯	現金のみ対応可能	支払方法の明確化	2025-04-02 07:37:34.657	2025-04-02 07:37:34.657	'お預かりした鍵の返却時に':1A 'カード決済は利用できません':3A '支払方法':5B '支払方法と精算タイミングは':7C '料金関連':4B '現金にて精算となります':2A '現金のみ対応可能':8 '現金精算':6B
80	料金関連	変更料金	早帰り	帰着日変更時の料金はどうなりますか？	早帰りの場合は来場時に表示された金額をご請求。延泊の場合は1日毎の料金を追加請求（ピーク該当日はピーク料金加算）。	f	◯	事前表示金額基準	変更時の料金明確化	2025-04-02 07:37:34.659	2025-04-02 07:37:34.659	'ピーク該当日はピーク料金加算':3A '事前表示金額基準':8 '変更料金':5B '帰着日変更時の料金はどうなりますか':7C '延泊の場合は1日毎の料金を追加請求':2A '料金関連':4B '早帰り':6B '早帰りの場合は来場時に表示された金額をご請求':1A
81	記入情報	フライト情報	便未定	便が未定ですが予約できますか？	予約可能です。以下のいずれかを備考欄に必ずご記入ください：・ツアー利用（確定時期も記載）・見送り利用・お迎え利用	f	◯	確定後はメールまたは電話でご連絡ください	未定予約の正確な情報管理	2025-04-02 07:37:34.661	2025-04-02 07:37:34.661	'お迎え利用':6A 'ツアー利用':3A 'フライト情報':8B '予約可能です':1A '以下のいずれかを備考欄に必ずご記入ください':2A '便が未定ですが予約できますか':10C '便未定':9B '確定後はメールまたは電話でご連絡ください':11 '確定時期も記載':4A '見送り利用':5A '記入情報':7B
82	記入情報	備考欄	必須事項	備考欄には何を記入すべきですか？	以下の情報は必ず記入してください：［必須事項］・1日利用の場合：「日帰り」・フライト未定の場合：理由を記載・複数台利用の場合：「家族/友達/会社で複数台利用」・制限に関わる荷物の記載	f	◯	必要な情報の記入漏れにご注意ください	重要情報の確実な伝達	2025-04-02 07:37:34.663	2025-04-02 07:37:34.663	'1日利用の場合':3A 'フライト未定の場合':5A '以下の情報は必ず記入してください':1A '会社で複数台利用':10A '備考欄':13B '備考欄には何を記入すべきですか':15C '制限に関わる荷物の記載':11A '友達':9A '家族':8A '必要な情報の記入漏れにご注意ください':16 '必須事項':2A,14B '日帰り':4A '理由を記載':6A '複数台利用の場合':7A '記入情報':12B
83	記入情報	個人情報	入力形式	個人情報はどのように入力すればよいですか？	以下の形式で入力してください：・お名前：カタカナ（例：ヤマダ タロウ）※姓名の間に1文字スペース・携帯番号：利用中に連絡可能な番号・メール：受信制限のないアドレス	f	◯	予約確認や緊急連絡に使用します	確実な連絡手段の確保	2025-04-02 07:37:34.666	2025-04-02 07:37:34.666	'お名前':2A 'カタカナ':3A 'タロウ':6A 'メール':10A 'ヤマダ':5A '予約確認や緊急連絡に使用します':16 '以下の形式で入力してください':1A '例':4A '個人情報':13B '個人情報はどのように入力すればよいですか':15C '入力形式':14B '利用中に連絡可能な番号':9A '受信制限のないアドレス':11A '姓名の間に1文字スペース':7A '携帯番号':8A '記入情報':12B
84	記入情報	フライト情報	確認項目	フライト情報の確認で注意すべき点は？	以下を必ず確認：1.国内線であること 2.便名と時刻の整合性 3.未定の場合は理由記載 4.見送り/お迎えの場合はその旨記載	f	◯	国際線利用の見落とし防止	フライト情報の正確な把握	2025-04-02 07:37:34.668	2025-04-02 07:37:34.668	'1':2A '2':4A '3':6A '4':8A 'お迎えの場合はその旨記載':10A 'フライト情報':12B 'フライト情報の確認で注意すべき点は':14C '以下を必ず確認':1A '便名と時刻の整合性':5A '国内線であること':3A '国際線利用の見落とし防止':15 '未定の場合は理由記載':7A '確認項目':13B '見送り':9A '記入情報':11B
85	記入情報	データ管理	修正手順	予約データの修正方法は？	1.変更箇所の特定 2.変更内容の記録 3.お客様への確認連絡 4.システムへの反映	f	◯	変更履歴の保持必要	予約データの正確な管理	2025-04-02 07:37:34.671	2025-04-02 07:37:34.671	'1':1A '2':3A '3':5A '4':7A 'お客様への確認連絡':6A 'システムへの反映':8A 'データ管理':10B '予約データの修正方法は':12C '修正手順':11B '変更内容の記録':4A '変更履歴の保持必要':13 '変更箇所の特定':2A '記入情報':9B
86	記入情報	データ修正	入力ミス	予約情報の入力ミスを発見した場合は？	1.正確な情報の確認 2.お客様への確認連絡 3.システムデータの修正 4.関係者への共有	f	◯	二重確認の徹底	情報精度の維持	2025-04-02 07:37:34.673	2025-04-02 07:37:34.673	'1':1A '2':3A '3':5A '4':7A 'お客様への確認連絡':4A 'システムデータの修正':6A 'データ修正':10B '予約情報の入力ミスを発見した場合は':12C '二重確認の徹底':13 '入力ミス':11B '正確な情報の確認':2A '記入情報':9B '関係者への共有':8A
87	利用制限	利用範囲	国際線	国際線の利用は可能ですか？	当駐車場は国内線ご利用のお客様専用となっております。	f	✖️	国際線ターミナルまでの送迎も含めご利用いただけません	国際線利用の問い合わせ防止	2025-04-02 07:37:34.675	2025-04-02 07:37:34.675	'利用制限':2B '利用範囲':3B '国際線':4B '国際線の利用は可能ですか':5C '国際線ターミナルまでの送迎も含めご利用いただけません':6 '当駐車場は国内線ご利用のお客様専用となっております':1A
88	利用制限	保険対象	対象外車両	外車（BMW、ベンツ、アウディなど）で利用したいのですが？	外車は場内保険の対象外となるため、お預かりできかねます。	f	✖️	場内保険の対象外である事実を明記	外車利用の問い合わせ対応	2025-04-02 07:37:34.677	2025-04-02 07:37:34.677	'bmw':7C 'お預かりできかねます':2A 'で利用したいのですが':10C 'アウディなど':9C 'ベンツ':8C '保険対象':4B '利用制限':3B '場内保険の対象外である事実を明記':11 '外車':6C '外車は場内保険の対象外となるため':1A '対象外車両':5B
89	利用制限	判断基準	受入不可	受入不可の判断基準は？	以下のいずれかに該当する場合は受入不可：1.国際線利用 2.保険対象外車両 3.サイズ制限超過 4.繁忙期の制限該当	f	✖️	例外なく適用する基準です	受入可否の明確な判断	2025-04-02 07:37:34.679	2025-04-02 07:37:34.679	'1':2A '2':4A '3':6A '4':8A 'サイズ制限超過':7A '以下のいずれかに該当する場合は受入不可':1A '例外なく適用する基準です':14 '保険対象外車両':5A '判断基準':11B '利用制限':10B '受入不可':12B '受入不可の判断基準は':13C '国際線利用':3A '繁忙期の制限該当':9A
90	免責約款	引渡後	責任範囲	車両引渡し後の事故や損傷についての責任は？	当駐車場内においてお客様へ車両をお引渡し後は、原則として車両に関する一切の責任を負いかねます。	f	◯	引渡後の免責を明確化	引渡後の責任範囲明確化	2025-04-02 07:37:34.681	2025-04-02 07:37:34.681	'免責約款':3B '原則として車両に関する一切の責任を負いかねます':2A '引渡後':4B '引渡後の免責を明確化':7 '当駐車場内においてお客様へ車両をお引渡し後は':1A '責任範囲':5B '車両引渡し後の事故や損傷についての責任は':6C
91	免責約款	車両損傷	補償範囲	車両の傷についてはどのように対応しますか？	お預り時及びお引渡し時の相互未確認の車両の傷は免責です。目視で確認できる範囲を記録しますが、細かな擦り傷やチェック漏れ、明らかに対象物のない傷は補償対象外です。ただし、保管中の当パーキングの管理上による明確な不手際は補償対象となります。	f	◯	事前確認が重要	車両損傷の補償範囲明確化	2025-04-02 07:37:34.683	2025-04-02 07:37:34.683	'お預り時及びお引渡し時の相互未確認の車両の傷は免責です':1A 'ただし':5A '事前確認が重要':11 '保管中の当パーキングの管理上による明確な不手際は補償対象となります':6A '免責約款':7B '明らかに対象物のない傷は補償対象外です':4A '目視で確認できる範囲を記録しますが':2A '細かな擦り傷やチェック漏れ':3A '補償範囲':9B '車両の傷についてはどのように対応しますか':10C '車両損傷':8B
92	免責約款	機械不具合	免責	エンジンなど機械面での不具合は補償されますか？	お預り期間中の内燃機関及び補機類（ミッションやアクセル）の不具合については、車両の新旧に関わらず一切免責とさせていただきます。	f	✖️	機械不具合は補償対象外	機械不具合の免責明確化	2025-04-02 07:37:34.686	2025-04-02 07:37:34.686	'お預り期間中の内燃機関及び補機類':1A 'の不具合については':3A 'エンジンなど機械面での不具合は補償されますか':8C 'ミッションやアクセル':2A '免責':7B '免責約款':5B '機械不具合':6B '機械不具合は補償対象外':9 '車両の新旧に関わらず一切免責とさせていただきます':4A
93	免責約款	ガラス損傷	免責	ガラスの傷は補償されますか？	走行中の飛び石によるフロントガラスやサイドガラスの傷は、不可抗力による損傷のため免責とさせていただきます。	f	✖️	不可抗力による損傷は補償対象外	ガラス損傷の免責明確化	2025-04-02 07:37:34.688	2025-04-02 07:37:34.688	'ガラスの傷は補償されますか':6C 'ガラス損傷':4B '不可抗力による損傷のため免責とさせていただきます':2A '不可抗力による損傷は補償対象外':7 '免責':5B '免責約款':3B '走行中の飛び石によるフロントガラスやサイドガラスの傷は':1A
94	免責約款	タイヤ	パンク対応	タイヤのパンク時の対応は？	パンクが発生した場合、走行不能のため、お客様の了承なしに修理を行う場合があります。修理代金はお客様のご負担となります。	f	△	修理費用は利用者負担	パンク時の対応明確化	2025-04-02 07:37:34.691	2025-04-02 07:37:34.691	'お客様の了承なしに修理を行う場合があります':3A 'タイヤ':6B 'タイヤのパンク時の対応は':8C 'パンクが発生した場合':1A 'パンク対応':7B '修理代金はお客様のご負担となります':4A '修理費用は利用者負担':9 '免責約款':5B '走行不能のため':2A
95	免責約款	車内物品	免責	車内の貴重品の取り扱いについて	車両内の金品については、事前のお申し出のないものに関しては、全て免責とさせていただきます。	f	✖️	事前申告のない物品は補償対象外	車内物品の免責明確化	2025-04-02 07:37:34.693	2025-04-02 07:37:34.693	'事前のお申し出のないものに関しては':2A '事前申告のない物品は補償対象外':8 '免責':6B '免責約款':4B '全て免責とさせていただきます':3A '車両内の金品については':1A '車内の貴重品の取り扱いについて':7C '車内物品':5B
96	免責約款	走行距離	増加	走行距離の増加について	駐車場内での移動のため、お預りした時点より走行距離が増える場合があります。	f	◯	場内移動による距離増加あり	走行距離増加の説明	2025-04-02 07:37:34.695	2025-04-02 07:37:34.695	'お預りした時点より走行距離が増える場合があります':2A '免責約款':3B '場内移動による距離増加あり':7 '増加':5B '走行距離':4B '走行距離の増加について':6C '駐車場内での移動のため':1A
97	免責約款	盗難	補償範囲	盗難時の補償について	お預りした車両が盗難に遭った場合、当社契約保険会社の定める範囲内での補償となり、余剰金額が発生した際はお客様負担となります。	f	△	保険範囲内での補償	盗難時の補償範囲明確化	2025-04-02 07:37:34.698	2025-04-02 07:37:34.698	'お預りした車両が盗難に遭った場合':1A '余剰金額が発生した際はお客様負担となります':3A '保険範囲内での補償':8 '免責約款':4B '当社契約保険会社の定める範囲内での補償となり':2A '盗難':5B '盗難時の補償について':7C '補償範囲':6B
98	免責約款	天災	免責	天災地変時の補償について	天災地変、台風、洪水、雪、雹、落雷、その他暴動、反乱等、当社以外の責めによって生じた損害は全て免責とさせていただきます。	f	✖️	天災等による損害は補償対象外	天災時の免責明確化	2025-04-02 07:37:34.701	2025-04-02 07:37:34.701	'その他暴動':7A '免責':12B '免責約款':10B '反乱等':8A '台風':2A '天災':11B '天災地変':1A '天災地変時の補償について':13C '天災等による損害は補償対象外':14 '当社以外の責めによって生じた損害は全て免責とさせていただきます':9A '洪水':3A '落雷':6A '雪':4A '雹':5A
99	免責約款	その他	判断基準	約款に記載のない事項が発生した場合は？	補償対象か否かに疑義が生じたクレーム、トラブルは、損害保険会社と弊社に一任いただき、保管記録と事実関係の調査に基づき保険契約内容を基準に決定いたします。	f	△	保険会社との協議により決定	未記載事項の対応明確化	2025-04-02 07:37:34.703	2025-04-02 07:37:34.703	'その他':6B 'トラブルは':2A '保管記録と事実関係の調査に基づき保険契約内容を基準に決定いたします':4A '保険会社との協議により決定':9 '免責約款':5B '判断基準':7B '損害保険会社と弊社に一任いただき':3A '約款に記載のない事項が発生した場合は':8C '補償対象か否かに疑義が生じたクレーム':1A
100	アクセス	検索方法	GoogleMap	GoogleMapでの検索方法を教えてください	1.「パーク＆ライド羽田」で検索 2.オプションから「高速道路を使わない」を設定してください。	f	◯	正確な位置表示のため必要な設定	GoogleMapでの検索方法案内	2025-04-02 07:37:34.705	2025-04-02 07:37:34.705	'1':1A '2':5A 'googlemap':11B 'googlemapでの検索方法を教えてください':12C 'で検索':4A 'を設定してください':8A 'アクセス':9B 'オプションから':6A 'パーク':2A 'ライド羽田':3A '検索方法':10B '正確な位置表示のため必要な設定':13 '高速道路を使わない':7A
101	アクセス	住所	目印	住所はどこになりますか？	東京都大田区京浜島2-1 京浜島ふ頭公園付近です。公園向かい側、首都高湾岸線高架下の駐車場となります。首都高の下にあるためピンポイントでの住所表示はされません。	f	◯	目印を参考に特定	住所案内の明確化	2025-04-02 07:37:34.708	2025-04-02 07:37:34.708	'-1':2A 'アクセス':7B '京浜島ふ頭公園付近です':3A '住所':8B '住所はどこになりますか':10C '公園向かい側':4A '東京都大田区京浜島2':1A '目印':9B '目印を参考に特定':11 '首都高の下にあるためピンポイントでの住所表示はされません':6A '首都高湾岸線高架下の駐車場となります':5A
102	アクセス	首都高湾岸線	東京方面	首都高湾岸線（東京方面）からのアクセスは？	『大井南』を出て国道357号線を羽田空港方面へ直進。信号2つ目を10M程越えて右側首都高湾岸線の高架下。※2つ目の信号を左折しないよう注意（京浜島には入りません）	f	◯	左折禁止の注意必要	東京方面からの経路案内	2025-04-02 07:37:34.711	2025-04-02 07:37:34.711	'2つ目の信号を左折しないよう注意':4A 'からのアクセスは':11C 'を出て国道357号線を羽田空港方面へ直進':2A 'アクセス':6B '京浜島には入りません':5A '信号2つ目を10m程越えて右側首都高湾岸線の高架下':3A '大井南':1A '左折禁止の注意必要':12 '東京方面':8B,10C '首都高湾岸線':7B,9C
103	アクセス	首都高湾岸線	横浜方面	首都高湾岸線（横浜方面）からのアクセスは？	『湾岸環八』を出て環七・大井埠頭方面（357号）へ。空港北トンネルを出て1つ目の信号を右折。次の信号も右折。10メートル程で右側に駐車場入り口。	f	◯	トンネル後の右折注意	横浜方面からの経路案内	2025-04-02 07:37:34.714	2025-04-02 07:37:34.714	'10メートル程で右側に駐車場入り口':8A '357号':4A 'からのアクセスは':14C 'へ':5A 'を出て環七':2A 'アクセス':9B 'トンネル後の右折注意':15 '大井埠頭方面':3A '横浜方面':11B,13C '次の信号も右折':7A '湾岸環八':1A '空港北トンネルを出て1つ目の信号を右折':6A '首都高湾岸線':10B,12C
104	アクセス	首都高羽田線	東京方面	首都高1号羽田線（東京方面）からのアクセスは？	『平和島出口』を出て、昭和島方面へ。南海橋を渡り1つ目の信号を左折。道なりに進み京和橋を渡り、国道357号線を羽田空港方面に右折。10メートル程で右側に駐車場入り口。	f	◯	2つの橋を経由	東京方面からの代替経路案内	2025-04-02 07:37:34.716	2025-04-02 07:37:34.716	'10メートル程で右側に駐車場入り口':7A '2つの橋を経由':14 'からのアクセスは':13C 'を出て':2A 'アクセス':8B '南海橋を渡り1つ目の信号を左折':4A '国道357号線を羽田空港方面に右折':6A '平和島出口':1A '昭和島方面へ':3A '東京方面':10B,12C '道なりに進み京和橋を渡り':5A '首都高1号羽田線':11C '首都高羽田線':9B
105	アクセス	首都高羽田線	横浜方面	首都高1号羽田線（横浜方面）からのアクセスは？	『羽田出口』を出て、環状8号線を羽田方面に右折。道なりに進み京浜急行の天空橋駅をこえて、2つ目の信号を左折。トンネルを出て、環七・大井埠頭方面（357号）へ。空港北トンネルを出て1つ目の信号を右折。次の信号も右折。10メートル程で右側に駐車場入り口。	f	◯	天空橋駅が目印	横浜方面からの代替経路案内	2025-04-02 07:37:34.718	2025-04-02 07:37:34.718	'10メートル程で右側に駐車場入り口':13A '2つ目の信号を左折':5A '357号':9A 'からのアクセスは':19C 'へ':10A 'を出て':2A 'アクセス':14B 'トンネルを出て':6A '大井埠頭方面':8A '天空橋駅が目印':20 '横浜方面':16B,18C '次の信号も右折':12A '環七':7A '環状8号線を羽田方面に右折':3A '空港北トンネルを出て1つ目の信号を右折':11A '羽田出口':1A '道なりに進み京浜急行の天空橋駅をこえて':4A '首都高1号羽田線':17C '首都高羽田線':15B
106	アクセス	目印	公園	最寄りの目印は何ですか？	1.京浜島ふ頭公園（向かい側） 2.首都高湾岸線高架下	f	◯	複数の目印を確認	目印情報の提供	2025-04-02 07:37:34.721	2025-04-02 07:37:34.721	'1':1A '2':4A 'アクセス':6B '京浜島ふ頭公園':2A '公園':8B '向かい側':3A '最寄りの目印は何ですか':9C '目印':7B '複数の目印を確認':10 '首都高湾岸線高架下':5A
107	アクセス	注意点	左折禁止	間違えやすい箇所はありますか？	1.東京方面から来る場合の2つ目の信号（左折禁止） 2.京浜島への進入	f	◯	誤進入に注意	要注意ポイントの明確化	2025-04-02 07:37:34.723	2025-04-02 07:37:34.723	'1':1A '2':4A 'アクセス':6B '京浜島への進入':5A '左折禁止':3A,8B '東京方面から来る場合の2つ目の信号':2A '注意点':7B '誤進入に注意':10 '間違えやすい箇所はありますか':9C
108	予約関連	キャンセル	基本方針	キャンセル料はいくらですか？キャンセルポリシーを教えてください。	当駐車場のキャンセルポリシーは以下の通りです。ご利用予定日の前日までのキャンセル：予約料金の20%、ご利用予定日当日のキャンセル：予約料金の50%をキャンセル料として申し受けます。お客様のご都合によるキャンセルにつきましても、上記のキャンセル料が発生いたしますので、ご了承ください。予約内容の変更やキャンセルをご希望の際は、できるだけ早めにご連絡いただけますようお願い申し上げます。	f	◯	キャンセルポリシーの基本情報。明確かつ簡潔に伝える。	キャンセルポリシーの明確化	2025-04-02 07:38:57.469	2025-04-02 07:38:57.469	'お客様のご都合によるキャンセルにつきましても':7A 'ご了承ください':9A 'ご利用予定日の前日までのキャンセル':2A 'ご利用予定日当日のキャンセル':4A 'できるだけ早めにご連絡いただけますようお願い申し上げます':11A 'をキャンセル料として申し受けます':6A 'キャンセル':13B 'キャンセルポリシーの基本情報':17 'キャンセルポリシーを教えてください':16C 'キャンセル料はいくらですか':15C '上記のキャンセル料が発生いたしますので':8A '予約内容の変更やキャンセルをご希望の際は':10A '予約料金の20':3A '予約料金の50':5A '予約関連':12B '基本方針':14B '当駐車場のキャンセルポリシーは以下の通りです':1A '明確かつ簡潔に伝える':18
109	予約関連	キャンセル	支払方法	キャンセル料はどのように支払えばよいですか？	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	f	◯	振込方法について具体的に案内し、振込手数料は顧客負担であることを明記。	キャンセルポリシーの明確化	2025-04-02 07:38:57.527	2025-04-02 07:38:57.527	'あらかじめご了承ください':8A 'お振込の際は':4A 'お気軽にお問い合わせください':10A 'ご不明な点がございましたら':9A 'なお':6A 'キャンセル':12B 'キャンセルが確定しましたら':2A 'キャンセル料のお支払いは振込にてお願いしております':1A 'キャンセル料の金額と振込先口座の情報をメールにてご案内いたします':3A 'キャンセル料はどのように支払えばよいですか':14C '予約番号をお名前の前に記載いただけますとスムーズに確認ができます':5A '予約関連':11B '振込手数料はお客様のご負担となりますので':7A '振込手数料は顧客負担であることを明記':16 '振込方法について具体的に案内し':15 '支払方法':13B
110	予約関連	キャンセル	部分キャンセル	3日間の予約をしましたが、2日目だけキャンセルしたいです。部分的なキャンセルはできますか？	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	f	◯	部分キャンセル不可の理由と、全キャンセル後の再予約という代替手段を説明。	キャンセルポリシーの明確化	2025-04-02 07:38:57.531	2025-04-02 07:38:57.531	'2日目だけキャンセルしたいです':23C '3日間の予約をしましたが':22C 'ありがとうございます':2A 'お問い合わせいただき':1A 'ご不便をおかけして申し訳ございませんが':17A 'ご希望のすべての日程に空きがある場合のみご予約が可能となります':16A 'ご希望の日程で改めてご予約いただく必要がございます':8A 'ご理解いただけますようお願い申し上げます':18A 'その場合':9A 'に基づくキャンセル料が発生いたします':13A 'また':14A 'キャンセル':20B '一部の日程のみのキャンセルは承っておりません':5A '予約関連':19B '全キャンセル後の再予約という代替手段を説明':26 '再予約の際は':15A '前日20':11A '当日50':12A '当駐車場では複数日のご予約について':4A '既存の予約に対してはキャンセルポリシー':10A '現在のご予約を一度全てキャンセルいただき':7A '誠に申し訳ございませんが':3A '部分キャンセル':21B '部分キャンセル不可の理由と':25 '部分的なキャンセルはできますか':24C '部分的な日程変更をご希望の場合は':6A
111	予約関連	キャンセル	天候不良・災害	台風で飛行機が欠航になりました。このような場合もキャンセル料は発生しますか？	お問い合わせいただき、ありがとうございます。台風による欠航というお客様のご状況、お察し申し上げます。当駐車場では、天候不良や災害時の欠航を含め、お客様のご都合によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。これは、予約枠の確保による機会損失と運営コストを考慮したものです。ただし、公共交通機関の運休や欠航が発生した場合は、運休・欠航証明書などの公的な証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。何卒ご理解とご協力をお願い申し上げます。	f	◯	基本的にキャンセル料が発生することを伝えつつ、証明書がある場合の個別対応の可能性を示唆。	キャンセルポリシーの明確化	2025-04-02 07:38:57.536	2025-04-02 07:38:57.536	'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様のご都合によるキャンセルにつきましても':7A 'お察し申し上げます':4A 'このような場合もキャンセル料は発生しますか':26C 'これは':12A 'ただし':14A 'を申し受けております':11A 'キャンセル':22B '予約枠の確保による機会損失と運営コストを考慮したものです':13A '予約関連':21B '何卒ご理解とご協力をお願い申し上げます':20A '個別に検討させていただくことも可能です':18A '公共交通機関の運休や欠航が発生した場合は':15A '前日20':9A '台風で飛行機が欠航になりました':25C '台風による欠航というお客様のご状況':3A '基本的には規定のキャンセル料':8A '基本的にキャンセル料が発生することを伝えつつ':27 '天候不良':23B '天候不良や災害時の欠航を含め':6A '当日50':10A '当駐車場では':5A '欠航証明書などの公的な証明書をご提出いただくことで':17A '災害':24B '証明書がある場合の個別対応の可能性を示唆':28 '該当の証明書をご提出いただけますでしょうか':19A '運休':16A
112	予約関連	キャンセル	病気・怪我	急病で利用できなくなりました。キャンセル料は免除できませんか？	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	f	◯	基本的にキャンセル料が発生することを伝えつつ、医療証明書がある場合の個別対応の可能性を示唆。	キャンセルポリシーの明確化	2025-04-02 07:38:57.54	2025-04-02 07:38:57.54	'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様のご状況に配慮しつつも':17A 'お客様の急病や怪我によるキャンセルにつきましても':6A 'お見舞い申し上げます':4A 'ご体調を崩されたとのこと':3A 'ただし':11A 'やむを得ない重篤な症状の場合は':13A 'を申し受けております':10A 'キャンセル':21B 'キャンセル料は免除できませんか':25C '予約関連':20B '何卒ご理解とご協力をお願い申し上げます':19A '個別に検討させていただくことも可能です':15A '入院など':12A '公平な運営を維持するための対応となりますので':18A '前日20':8A '医療証明書がある場合の個別対応の可能性を示唆':27 '基本的には規定のキャンセル料':7A '基本的にキャンセル料が発生することを伝えつつ':26 '当日50':9A '当駐車場では':5A '急病で利用できなくなりました':24C '怪我':23B '病気':22B '診断書や入院証明書などの医療機関の証明書をご提出いただくことで':14A '該当の証明書をご提出いただけますでしょうか':16A
113	利用の流れ	営業時間	基本情報	駐車場の営業時間を教えてください。何時から何時まで利用できますか？	当駐車場の営業時間は午前5時から午前0時（深夜24時）までとなっております。営業時間外のお問い合わせにつきましては、翌営業日以降の対応となりますことをご了承ください。	f	◯	駐車場の営業時間とサポートの受付時間を明確に区別して説明する。	営業時間の明確化	2025-04-02 07:39:28.19	2025-04-02 07:39:28.19	'までとなっております':3A '何時から何時まで利用できますか':10C '利用の流れ':6B '営業時間':7B '営業時間外のお問い合わせにつきましては':4A '基本情報':8B '当駐車場の営業時間は午前5時から午前0時':1A '深夜24時':2A '翌営業日以降の対応となりますことをご了承ください':5A '駐車場の営業時間とサポートの受付時間を明確に区別して説明する':11 '駐車場の営業時間を教えてください':9C
114	特殊対応	規則否定	基本対応	御社の規則は間違っている。変更すべきだ。	この度はご意見をいただき、誠にありがとうございます。当駐車場のルールは、多くのお客様の安全と満足のために慎重に設計されております。いただいたご意見は今後のサービス改善の参考とさせていただきます。しかしながら、現時点では規定の通りの運用となりますので、ご理解いただけますと幸いです。ご不明点やご要望がございましたら、お気軽にお問い合わせください。	f	◯	感情的にならず、丁寧に、しかし毅然とした態度で対応する。規則の根拠をさりげなく示す。	特殊対応の明確化	2025-04-02 07:40:01.409	2025-04-02 07:40:01.409	'いただいたご意見は今後のサービス改善の参考とさせていただきます':5A 'お気軽にお問い合わせください':10A 'この度はご意見をいただき':1A 'ご不明点やご要望がございましたら':9A 'ご理解いただけますと幸いです':8A 'しかしながら':6A 'しかし毅然とした態度で対応する':18 '丁寧に':17 '基本対応':13B '変更すべきだ':15C '多くのお客様の安全と満足のために慎重に設計されております':4A '当駐車場のルールは':3A '御社の規則は間違っている':14C '感情的にならず':16 '特殊対応':11B '現時点では規定の通りの運用となりますので':7A '規則の根拠をさりげなく示す':19 '規則否定':12B '誠にありがとうございます':2A
115	特殊対応	例外要求	不可能な要求	私だけ特別に規則を曲げてほしい。例外として認めるべきだ。	お問い合わせいただき、ありがとうございます。ご要望の内容につきまして、誠に申し訳ございませんが、公平なサービス提供と安全管理の観点から、すべてのお客様に同一の規則を適用させていただいております。特定のお客様のみに例外を設けることは、他のお客様との公平性を損なう可能性があるため、ご理解いただけますと幸いです。	f	◯	公平性の観点を強調し、代替案の可能性を示唆する。	特殊対応の明確化	2025-04-02 07:40:01.467	2025-04-02 07:40:01.467	'ありがとうございます':2A 'お問い合わせいただき':1A 'ご理解いただけますと幸いです':9A 'ご要望の内容につきまして':3A 'すべてのお客様に同一の規則を適用させていただいております':6A '不可能な要求':12B '他のお客様との公平性を損なう可能性があるため':8A '代替案の可能性を示唆する':16 '例外として認めるべきだ':14C '例外要求':11B '公平なサービス提供と安全管理の観点から':5A '公平性の観点を強調し':15 '特定のお客様のみに例外を設けることは':7A '特殊対応':10B '私だけ特別に規則を曲げてほしい':13C '誠に申し訳ございませんが':4A
116	特殊対応	料金クレーム	料金否定	料金設定がおかしい。もっと安くすべきだ。不当に高い。	この度はご意見をいただき、誠にありがとうございます。当駐車場の料金体系は、立地条件、設備維持費、セキュリティ対策、人件費など複数の要因を考慮して設定しております。市場相場や提供するサービス内容とのバランスを取りながら、適正価格の維持に努めております。お客様にとって最適なプランをご提案できるよう各種割引プランもご用意しておりますので、ご検討いただければ幸いです。ご不明点やご要望がございましたら、お気軽にお問い合わせください。	f	◯	料金設定の根拠を示しつつ、割引オプションがあれば提案する。	特殊対応の明確化	2025-04-02 07:40:01.471	2025-04-02 07:40:01.471	'お客様にとって最適なプランをご提案できるよう各種割引プランもご用意しておりますので':10A 'お気軽にお問い合わせください':13A 'この度はご意見をいただき':1A 'ご不明点やご要望がございましたら':12A 'ご検討いただければ幸いです':11A 'もっと安くすべきだ':18C 'セキュリティ対策':6A '不当に高い':19C '人件費など複数の要因を考慮して設定しております':7A '割引オプションがあれば提案する':21 '市場相場や提供するサービス内容とのバランスを取りながら':8A '当駐車場の料金体系は':3A '料金クレーム':15B '料金否定':16B '料金設定がおかしい':17C '料金設定の根拠を示しつつ':20 '特殊対応':14B '立地条件':4A '設備維持費':5A '誠にありがとうございます':2A '適正価格の維持に努めております':9A
117	特殊対応	過剰要求	不合理な要求	車に傷がついた。全額補償すべきだ。新車に交換しろ。	この度は、お車に関するご報告をいただき、誠にありがとうございます。お客様のお車に関する状況を深くお察し申し上げます。当駐車場では、免責約款に記載の通り、お車の管理については所定の補償範囲内での対応とさせていただいております。具体的な状況確認のため、お車の損傷状態の写真や発生状況の詳細をお送りいただけますと幸いです。ご提供いただいた情報を基に、保険適用の可否や当駐車場の責任範囲について精査させていただきます。なお、新車への交換などの過大な補償は承りかねますが、当駐車場の責任が認められる場合は、適切な修理費用の範囲内で誠意をもって対応させていただきます。ご理解いただけますと幸いです。	f	◯	免責約款を明記しつつ、過大な要求には応じられないことを明確に伝える。証拠収集を促す。	特殊対応の明確化	2025-04-02 07:40:01.474	2025-04-02 07:40:01.474	'お客様のお車に関する状況を深くお察し申し上げます':4A 'お車に関するご報告をいただき':2A 'お車の損傷状態の写真や発生状況の詳細をお送りいただけますと幸いです':9A 'お車の管理については所定の補償範囲内での対応とさせていただいております':7A 'この度は':1A 'ご提供いただいた情報を基に':10A 'ご理解いただけますと幸いです':16A 'なお':12A '不合理な要求':19B '保険適用の可否や当駐車場の責任範囲について精査させていただきます':11A '免責約款に記載の通り':6A '免責約款を明記しつつ':23 '全額補償すべきだ':21C '具体的な状況確認のため':8A '当駐車場では':5A '当駐車場の責任が認められる場合は':14A '新車に交換しろ':22C '新車への交換などの過大な補償は承りかねますが':13A '特殊対応':17B '証拠収集を促す':25 '誠にありがとうございます':3A '車に傷がついた':20C '過剰要求':18B '過大な要求には応じられないことを明確に伝える':24 '適切な修理費用の範囲内で誠意をもって対応させていただきます':15A
118	特殊対応	無視判断	判断基準	どのような場合に問い合わせを無視すべきか？	以下の条件に該当する場合、返信を控えるか、定型文による最小限の対応を検討してください：1) 同一人物から同一内容で3回以上の繰り返し問い合わせがある場合、2) 明らかな脅迫や暴言、差別的表現が含まれる場合、3) 詐欺の疑いが強い不自然な要求の場合、4) 当社サービスと全く関係のない内容の場合。これらに該当する問い合わせは、上長へ報告の上、対応方針を相談してください。なお、単なる不満や批判は無視せず、丁寧に対応することが基本です。	f	◯	社内向けナレッジ。実際の顧客には送らないこと。無視が適切な状況についてのガイドライン。	特殊対応の明確化	2025-04-02 07:40:01.478	2025-04-02 07:40:01.478	'1':4A '2':6A '3':9A '4':11A 'これらに該当する問い合わせは':13A 'どのような場合に問い合わせを無視すべきか':22C 'なお':16A '丁寧に対応することが基本です':18A '上長へ報告の上':14A '以下の条件に該当する場合':1A '判断基準':21B '単なる不満や批判は無視せず':17A '同一人物から同一内容で3回以上の繰り返し問い合わせがある場合':5A '定型文による最小限の対応を検討してください':3A '実際の顧客には送らないこと':24 '対応方針を相談してください':15A '差別的表現が含まれる場合':8A '当社サービスと全く関係のない内容の場合':12A '明らかな脅迫や暴言':7A '無視が適切な状況についてのガイドライン':25 '無視判断':20B '特殊対応':19B '社内向けナレッジ':23 '詐欺の疑いが強い不自然な要求の場合':10A '返信を控えるか':2A
119	特殊対応	脅迫・威圧	法的措置示唆	要求を受け入れないなら法的手段に訴える。弁護士に相談済みだ。	お問い合わせいただき、ありがとうございます。お客様のご懸念とご要望は真摯に受け止めております。当駐車場では、すべてのお客様に公平かつ適切なサービスを提供するため、規定に基づいた対応を行っております。法的手段についてお考えとのことですが、まずは双方にとって最善の解決策を話し合いにより見出したいと考えております。具体的なご状況をさらに詳しくお聞かせいただけますでしょうか。なお、法的なご質問や主張につきましては、必要に応じて当社の法務部門で対応させていただくこともございますので、ご了承ください。何卒ご理解いただけますと幸いです。	f	◯	冷静に対応し、脅迫に動じない姿勢を示す。必要に応じて法務部門への連携を示唆する。	特殊対応の明確化	2025-04-02 07:40:01.482	2025-04-02 07:40:01.482	'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様のご懸念とご要望は真摯に受け止めております':3A 'ご了承ください':13A 'すべてのお客様に公平かつ適切なサービスを提供するため':5A 'なお':10A 'まずは双方にとって最善の解決策を話し合いにより見出したいと考えております':8A '何卒ご理解いただけますと幸いです':14A '具体的なご状況をさらに詳しくお聞かせいただけますでしょうか':9A '冷静に対応し':21 '威圧':17B '弁護士に相談済みだ':20C '当駐車場では':4A '必要に応じて当社の法務部門で対応させていただくこともございますので':12A '必要に応じて法務部門への連携を示唆する':23 '法的なご質問や主張につきましては':11A '法的手段についてお考えとのことですが':7A '法的措置示唆':18B '特殊対応':15B '脅迫':16B '脅迫に動じない姿勢を示す':22 '要求を受け入れないなら法的手段に訴える':19C '規定に基づいた対応を行っております':6A
120	特殊対応	脅迫・威圧	SNS拡散示唆	要求を聞かないならSNSで拡散して評判を落とす。	お問い合わせいただき、ありがとうございます。お客様のご不満やご要望について、真摯に受け止めております。当駐車場では、すべてのお客様のご意見を大切にし、サービス向上に努めておりますが、規定に基づいた公平な対応を心がけております。SNSでの情報発信はお客様の自由ですが、建設的な対話を通じて解決策を見出すことが、双方にとって最善の方法ではないかと考えております。具体的なご状況や改善へのご提案がございましたら、ぜひお聞かせください。お客様のご理解とご協力を何卒よろしくお願い申し上げます。	f	◯	脅迫に動じず、建設的な対話を促す。事実に基づかない情報拡散は法的問題になる可能性があることには触れない（過度な警告と受け取られる可能性があるため）。	特殊対応の明確化	2025-04-02 07:40:01.485	2025-04-02 07:40:01.485	'snsでの情報発信はお客様の自由ですが':9A 'sns拡散示唆':18B 'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様のご不満やご要望について':3A 'お客様のご理解とご協力を何卒よろしくお願い申し上げます':14A 'すべてのお客様のご意見を大切にし':6A 'ぜひお聞かせください':13A 'サービス向上に努めておりますが':7A '事実に基づかない情報拡散は法的問題になる可能性があることには触れない':22 '具体的なご状況や改善へのご提案がございましたら':12A '双方にとって最善の方法ではないかと考えております':11A '威圧':17B '建設的な対話を促す':21 '建設的な対話を通じて解決策を見出すことが':10A '当駐車場では':5A '特殊対応':15B '真摯に受け止めております':4A '脅迫':16B '脅迫に動じず':20 '要求を聞かないならsnsで拡散して評判を落とす':19C '規定に基づいた公平な対応を心がけております':8A '過度な警告と受け取られる可能性があるため':23
121	特殊対応	暴言・侮辱	人格攻撃	（スタッフへの暴言や人格攻撃を含む問い合わせ）	お問い合わせいただき、ありがとうございます。お客様のお気持ちやご状況により、強い表現になられたことと存じます。当駐車場では、すべてのお客様に快適にご利用いただけるよう、そしてスタッフが適切にサポートできるよう努めております。より建設的な対話を通じて、お客様のご要望やご不満の解決に取り組みたいと考えておりますので、具体的なご状況を改めてお聞かせいただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	f	◯	暴言そのものには直接触れず、建設的な対話を促す。繰り返される場合は対応中止も検討。	特殊対応の明確化	2025-04-02 07:40:01.489	2025-04-02 07:40:01.489	'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様のお気持ちやご状況により':3A 'お客様のご要望やご不満の解決に取り組みたいと考えておりますので':9A 'すべてのお客様に快適にご利用いただけるよう':6A 'そしてスタッフが適切にサポートできるよう努めております':7A 'より建設的な対話を通じて':8A 'スタッフへの暴言や人格攻撃を含む問い合わせ':16C '人格攻撃':15B '何卒ご理解とご協力をお願い申し上げます':11A '侮辱':14B '具体的なご状況を改めてお聞かせいただけますと幸いです':10A '建設的な対話を促す':18 '強い表現になられたことと存じます':4A '当駐車場では':5A '暴言':13B '暴言そのものには直接触れず':17 '特殊対応':12B '繰り返される場合は対応中止も検討':19
122	特殊対応	事実誤認	虚偽主張	（利用実績がないにも関わらず）先日利用した際にスタッフの対応が悪かった。補償しろ。	お問い合わせいただき、ありがとうございます。ご不快な思いをされたとのこと、申し訳ございません。お客様のご指摘について適切に調査・対応させていただくため、ご利用日時、予約番号、お車の情報など、具体的な詳細をお知らせいただけますでしょうか。当駐車場では、すべてのご利用記録を管理しており、詳細を確認させていただいた上で、適切な対応をさせていただきます。お手数ではございますが、正確な状況確認のため、追加情報のご提供をお願い申し上げます。	f	◯	直接的に「ご利用の記録がない」とは言わず、証拠提示を求める。詳細情報の提供を求めることで対応を進める。	特殊対応の明確化	2025-04-02 07:40:01.492	2025-04-02 07:40:01.492	'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様のご指摘について適切に調査':5A 'お手数ではございますが':15A 'お車の情報など':9A 'ご不快な思いをされたとのこと':3A 'ご利用の記録がない':25 'ご利用日時':7A 'すべてのご利用記録を管理しており':12A 'とは言わず':26 '予約番号':8A '事実誤認':19B '先日利用した際にスタッフの対応が悪かった':22C '具体的な詳細をお知らせいただけますでしょうか':10A '利用実績がないにも関わらず':21C '対応させていただくため':6A '当駐車場では':11A '正確な状況確認のため':16A '特殊対応':18B '申し訳ございません':4A '直接的に':24 '虚偽主張':20B '補償しろ':23C '証拠提示を求める':27 '詳細を確認させていただいた上で':13A '詳細情報の提供を求めることで対応を進める':28 '追加情報のご提供をお願い申し上げます':17A '適切な対応をさせていただきます':14A
123	特殊対応	繰り返し問い合わせ	同一内容反復	（同じ内容で3回目以上の問い合わせ）	お問い合わせいただき、ありがとうございます。お客様には既に（前回の日付）付けのメールにて回答を差し上げており、当駐車場の対応方針に変更はございません。重ねてのご連絡となり恐縮ですが、（核となる回答内容の要約）となります。何か新たなご質問やご状況の変化がございましたら、具体的にお知らせいただけますと幸いです。何卒ご理解いただけますようお願い申し上げます。なお、今後のお問い合わせにつきましては、新たな情報や状況の変化がある場合にご連絡いただけますようお願いいたします。	f	◯	過去の回答を明示し、新たな情報がなければこれ以上の対応がないことを示唆する。これが最後の回答であることを暗に伝える。	特殊対応の明確化	2025-04-02 07:40:01.495	2025-04-02 07:40:01.495	'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様には既に':3A 'これが最後の回答であることを暗に伝える':22 'となります':9A 'なお':13A '今後のお問い合わせにつきましては':14A '付けのメールにて回答を差し上げており':5A '何か新たなご質問やご状況の変化がございましたら':10A '何卒ご理解いただけますようお願い申し上げます':12A '具体的にお知らせいただけますと幸いです':11A '前回の日付':4A '同じ内容で3回目以上の問い合わせ':19C '同一内容反復':18B '当駐車場の対応方針に変更はございません':6A '新たな情報がなければこれ以上の対応がないことを示唆する':21 '新たな情報や状況の変化がある場合にご連絡いただけますようお願いいたします':15A '核となる回答内容の要約':8A '特殊対応':16B '繰り返し問い合わせ':17B '過去の回答を明示し':20 '重ねてのご連絡となり恐縮ですが':7A
124	特殊対応	料金クレーム	キャンセル料拒否	キャンセル料を払うつもりはない。払う必要がないはずだ。規約に同意していない。	お問い合わせいただき、ありがとうございます。キャンセル料に関するご意見を頂戴し、ご不満に感じられていることは理解しております。当駐車場のキャンセルポリシーは、ご予約時にご同意いただいている利用規約に明記されており、前日キャンセルで20%、当日キャンセルで50%のキャンセル料を申し受けております。これは予約枠の確保による機会損失と運営コストを考慮したものです。ご予約手続きの完了をもって規約にご同意いただいたものとさせていただいておりますため、何卒ご理解いただけますようお願い申し上げます。	f	◯	規約への同意は予約完了時点で得られていることを説明。特別な事情があれば個別対応の可能性も示唆。	特殊対応の明確化	2025-04-02 07:40:01.499	2025-04-02 07:40:01.499	'ありがとうございます':2A 'お問い合わせいただき':1A 'これは予約枠の確保による機会損失と運営コストを考慮したものです':10A 'ご不満に感じられていることは理解しております':4A 'ご予約手続きの完了をもって規約にご同意いただいたものとさせていただいておりますため':11A 'ご予約時にご同意いただいている利用規約に明記されており':6A 'のキャンセル料を申し受けております':9A 'キャンセル料に関するご意見を頂戴し':3A 'キャンセル料を払うつもりはない':16C 'キャンセル料拒否':15B '何卒ご理解いただけますようお願い申し上げます':12A '前日キャンセルで20':7A '当日キャンセルで50':8A '当駐車場のキャンセルポリシーは':5A '払う必要がないはずだ':17C '料金クレーム':14B '特別な事情があれば個別対応の可能性も示唆':20 '特殊対応':13B '規約に同意していない':18C '規約への同意は予約完了時点で得られていることを説明':19
125	特殊対応	例外要求	キャンセル料免除	急病でキャンセルしたのにキャンセル料を取るのは非常識だ。免除すべきだ。	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では基本的に、ご予約のキャンセルにつきましては規定のキャンセル料（前日20%、当日50%）を申し受けておりますが、急病や入院など、やむを得ない事情による場合は、状況に応じて個別に検討させていただいております。つきましては、診断書や入院証明書など、状況を確認できる書類をご提供いただけますでしょうか。ご提出いただいた書類を確認の上、キャンセル料の減免について検討させていただきます。何卒ご理解とご協力をお願い申し上げます。	f	◯	急病等の場合は証明書の提出を条件に免除検討の可能性を示す。証拠なしでの免除は認めない。	特殊対応の明確化	2025-04-02 07:40:01.502	2025-04-02 07:40:01.502	'ありがとうございます':2A 'お問い合わせいただき':1A 'お見舞い申し上げます':4A 'ご予約のキャンセルにつきましては規定のキャンセル料':6A 'ご体調を崩されたとのこと':3A 'ご提出いただいた書類を確認の上':16A 'つきましては':13A 'やむを得ない事情による場合は':11A 'を申し受けておりますが':9A 'キャンセル料の減免について検討させていただきます':17A 'キャンセル料免除':21B '何卒ご理解とご協力をお願い申し上げます':18A '例外要求':20B '免除すべきだ':23C '前日20':7A '当日50':8A '当駐車場では基本的に':5A '急病でキャンセルしたのにキャンセル料を取るのは非常識だ':22C '急病や入院など':10A '急病等の場合は証明書の提出を条件に免除検討の可能性を示す':24 '特殊対応':19B '状況に応じて個別に検討させていただいております':12A '状況を確認できる書類をご提供いただけますでしょうか':15A '診断書や入院証明書など':14A '証拠なしでの免除は認めない':25
126	特殊対応	料金クレーム	キャンセル料計算	キャンセル料の計算が間違っている。もっと安くなるはずだ。	お問い合わせいただき、ありがとうございます。キャンセル料の計算についてご確認いただき、感謝申し上げます。当駐車場のキャンセルポリシーでは、ご利用予定日の前日までのキャンセルは予約料金の20%、当日のキャンセルは50%をキャンセル料として申し受けております。お客様のご予約（予約番号：○○○○）につきましては、○月○日○時のキャンセルとなり、予約料金○○円の○○%である○○円をキャンセル料として計算しております。計算に誤りがあるとお感じの点について、具体的にご教示いただけますと、詳細を確認させていただきます。なお、キャンセル料の計算方法や根拠についてのご質問がございましたら、お気軽にお問い合わせください。	f	◯	具体的な計算根拠を示し、透明性を確保する。クレームの具体的内容を聞き出す。	特殊対応の明確化	2025-04-02 07:40:01.506	2025-04-02 07:40:01.506	'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様のご予約':9A 'お気軽にお問い合わせください':24A 'ご利用予定日の前日までのキャンセルは予約料金の20':6A 'である':17A 'なお':22A 'につきましては':11A 'もっと安くなるはずだ':29C 'をキャンセル料として申し受けております':8A 'キャンセル料の計算が間違っている':28C 'キャンセル料の計算についてご確認いただき':3A 'キャンセル料の計算方法や根拠についてのご質問がございましたら':23A 'キャンセル料計算':27B 'クレームの具体的内容を聞き出す':32 '予約料金':15A '予約番号':10A '具体的な計算根拠を示し':30 '具体的にご教示いただけますと':20A '円の':16A '円をキャンセル料として計算しております':18A '当日のキャンセルは50':7A '当駐車場のキャンセルポリシーでは':5A '感謝申し上げます':4A '料金クレーム':26B '日':13A '時のキャンセルとなり':14A '月':12A '特殊対応':25B '計算に誤りがあるとお感じの点について':19A '詳細を確認させていただきます':21A '透明性を確保する':31
127	特殊対応	無断行為	ノーショウ	予約をキャンセルしたつもりだった。キャンセル料を請求されたが納得できない。	お問い合わせいただき、ありがとうございます。ご予約のキャンセルについてのご連絡が行き違いになってしまったようで、ご不便をおかけし申し訳ございません。当駐車場の記録では、お客様からのキャンセルのご連絡は確認できておりません。キャンセルをご希望の際は、お電話またはメールにて事前にご連絡いただく必要がございます。ご連絡がない場合はノーショウ（無断キャンセル）として取り扱い、予約料金の50%をキャンセル料として申し受けております。ただし、お客様がキャンセルの意思をお持ちだったとのことですので、キャンセルの経緯や状況について詳しくお聞かせいただけませんでしょうか。状況により、キャンセル料の一部調整が可能な場合もございますので、ご事情をお知らせください。	f	◯	ノーショウの場合は100%請求が原則だが、状況によっては調整の余地があることを示唆。事実確認を重視。	特殊対応の明確化	2025-04-02 07:40:01.509	2025-04-02 07:40:01.509	'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様からのキャンセルのご連絡は確認できておりません':6A 'お客様がキャンセルの意思をお持ちだったとのことですので':15A 'お電話またはメールにて事前にご連絡いただく必要がございます':8A 'ご不便をおかけし申し訳ございません':4A 'ご予約のキャンセルについてのご連絡が行き違いになってしまったようで':3A 'ご事情をお知らせください':19A 'ご連絡がない場合はノーショウ':9A 'ただし':14A 'として取り扱い':11A 'をキャンセル料として申し受けております':13A 'キャンセルの経緯や状況について詳しくお聞かせいただけませんでしょうか':16A 'キャンセルをご希望の際は':7A 'キャンセル料の一部調整が可能な場合もございますので':18A 'キャンセル料を請求されたが納得できない':24C 'ノーショウ':22B 'ノーショウの場合は100':25 '予約をキャンセルしたつもりだった':23C '予約料金の50':12A '事実確認を重視':28 '当駐車場の記録では':5A '無断キャンセル':10A '無断行為':21B '特殊対応':20B '状況によっては調整の余地があることを示唆':27 '状況により':17A '請求が原則だが':26
128	特殊対応	例外要求	部分キャンセル拒否	一部だけキャンセルできないのはおかしい。柔軟に対応すべきだ。	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	f	◯	部分キャンセル不可の理由を詳細に説明し、システム上の制約と運営方針を明確に伝える。	特殊対応の明確化	2025-04-02 07:40:01.513	2025-04-02 07:40:01.513	'ありがとうございます':2A 'お問い合わせいただき':1A 'お客様には大変ご不便をおかけしますが':11A 'これは':8A 'ご希望の日程でのご利用が可能となるよう':14A 'システム上の制約と運営方針を明確に伝える':24 '一部だけキャンセルできないのはおかしい':21C '予約システムの仕様上および公平な予約枠管理の観点から':6A '予約システムの安定運用と公平な予約枠の提供のため':12A '他のお客様に有効活用いただけなくなるためです':10A '何卒ご理解とご協力をお願い申し上げます':17A '例外要求':19B '当駐車場では':5A '承りました':4A '改めてご希望日程での予約をご検討いただけますと幸いです':16A '柔軟に対応すべきだ':22C '特殊対応':18B '現在の予約をキャンセルいただき':15A '現在の方針とさせていただいております':13A '複数日予約の部分キャンセルに対応しておりません':7A '部分キャンセルに関するご意見':3A '部分キャンセル不可の理由を詳細に説明し':23 '部分キャンセル拒否':20B '部分的にキャンセルされた日程が断片的に空き状態となり':9A
129	対応	クレーム	基本方針	クレームや苦情があった場合の対応方針を教えてください。	お客様からのご意見・ご要望は真摯に受け止め、迅速かつ丁寧な対応を心がけております。問題の内容を正確に把握し、適切な解決策をご提案いたします。また、同様の問題が再発しないよう、サービス改善にも努めております。お客様のご不満やご意見は、当社のサービス向上のための貴重なご意見として承っております。	f	◯	クレーム対応の基本方針を明確に伝え、お客様の声を大切にしていることを強調する。	クレーム対応の基本姿勢	2025-04-02 07:40:41.002	2025-04-02 07:40:41.002	'お客様からのご意見':1A 'お客様のご不満やご意見は':9A 'お客様の声を大切にしていることを強調する':16 'ご要望は真摯に受け止め':2A 'また':6A 'クレーム':12B 'クレームや苦情があった場合の対応方針を教えてください':14C 'クレーム対応の基本方針を明確に伝え':15 'サービス改善にも努めております':8A '同様の問題が再発しないよう':7A '問題の内容を正確に把握し':4A '基本方針':13B '対応':11B '当社のサービス向上のための貴重なご意見として承っております':10A '迅速かつ丁寧な対応を心がけております':3A '適切な解決策をご提案いたします':5A
130	対応	クレーム	返金対応	返金対応はしてもらえますか？	お客様のご状況とご不満の内容を詳しくお伺いした上で、当社の返金ポリシーに基づき適切に対応させていただきます。明らかな当社の過失によるサービス不備の場合は、状況に応じて全額または一部返金の対応をさせていただくことがございます。具体的な状況をお知らせいただければ、個別に検討させていただきます。	f	◯	返金対応の可能性を示しつつも、一律の返金ではなく状況に応じた対応であることを伝える。	返金対応の条件と手続き	2025-04-02 07:40:41.071	2025-04-02 07:40:41.071	'お客様のご状況とご不満の内容を詳しくお伺いした上で':1A 'クレーム':8B '一律の返金ではなく状況に応じた対応であることを伝える':12 '個別に検討させていただきます':6A '具体的な状況をお知らせいただければ':5A '対応':7B '当社の返金ポリシーに基づき適切に対応させていただきます':2A '明らかな当社の過失によるサービス不備の場合は':3A '状況に応じて全額または一部返金の対応をさせていただくことがございます':4A '返金対応':9B '返金対応の可能性を示しつつも':11 '返金対応はしてもらえますか':10C
131	対応	クレーム	責任者対応	責任者に直接話を聞いてもらえますか？	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	f	◯	責任者対応の可能性を示しつつも、まずは担当者が状況を把握する必要があることを伝える。	責任者対応の手続きと条件	2025-04-02 07:40:41.075	2025-04-02 07:40:41.075	'お客様のご要望とご連絡先をお伺いできますでしょうか':9A 'ご不満やご要望について責任者への取り次ぎをご希望とのこと':1A 'すぐにご対応できない場合もございますので':7A 'その際は改めてご連絡させていただくことになります':8A 'まずは担当者が状況を把握する必要があることを伝える':15 'まず担当スタッフが状況を詳しくお伺いした上で':4A 'クレーム':11B '対応':10B '必要に応じて責任者に引き継がせていただいております':5A '承知いたしました':2A '現在の責任者の在席状況や予定によっては':6A '責任者に直接話を聞いてもらえますか':13C '責任者への取り次ぎについては':3A '責任者対応':12B '責任者対応の可能性を示しつつも':14
132	予約関連	キャンセル	キャンセル方法	キャンセルの手続き方法について教えてください。	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	f	◯	キャンセル手続きの具体的な方法について説明。	キャンセルポリシーの明確化	2025-04-03 10:11:12.067	2025-04-03 10:11:12.067	'1':2A '2':6A 'お気軽にお問い合わせください':20A 'お電話いただき':4A 'お電話でのキャンセル':3A 'からご連絡ください':10A 'ご予約時にお送りした予約確認メールに返信または当駐車場のweb':8A 'なお':13A 'に基づいて発生し':17A 'オンラインでのキャンセル':7A 'キャンセル':22B 'キャンセルのお手続きは以下の方法で承っております':1A 'キャンセルの手続き方法について教えてください':24C 'キャンセル手続きについてご不明な点がございましたら':19A 'キャンセル手続きの具体的な方法について説明':25 'キャンセル手続き完了後':11A 'キャンセル料については規定':14A 'キャンセル料金は振込でのお支払いとなります':18A 'キャンセル方法':23B 'キャンセル連絡はこちら':9A '予約番号とお名前をお伝えください':5A '予約関連':21B '前日20':15A '当日50':16A '確認メールをお送りいたします':12A
133	予約関連	キャンセル	キャンセル期限	キャンセルはいつまでにすればよいですか？	当駐車場のキャンセル期限についてご案内いたします。キャンセル料金の発生を最小限にするには、ご利用予定日の前々日までにキャンセルをお願いいたします。前日までのキャンセルは予約料金の20％、ご利用当日のキャンセルは50％のキャンセル料が発生いたします。なお、キャンセル手続きは24時間いつでも受け付けておりますが、キャンセル料の計算は予約開始時刻の前日・当日で判断いたします。例えば、5月10日14:00からの予約の場合、5月9日23:59までが前日キャンセル扱いとなります。できるだけ早めのご連絡をお願いいたします。	f	◯	キャンセル期限について具体的な例を入れて説明。	キャンセルポリシーの明確化	2025-04-03 10:11:12.387	2025-04-03 10:11:12.387	'00からの予約の場合':13A '59までが前日キャンセル扱いとなります':15A '5月10日14':12A '5月9日23':14A 'ご利用予定日の前々日までにキャンセルをお願いいたします':3A 'ご利用当日のキャンセルは50':5A 'できるだけ早めのご連絡をお願いいたします':16A 'なお':7A 'のキャンセル料が発生いたします':6A 'キャンセル':18B 'キャンセルはいつまでにすればよいですか':20C 'キャンセル手続きは24時間いつでも受け付けておりますが':8A 'キャンセル料の計算は予約開始時刻の前日':9A 'キャンセル料金の発生を最小限にするには':2A 'キャンセル期限':19B 'キャンセル期限について具体的な例を入れて説明':21 '予約関連':17B '例えば':11A '前日までのキャンセルは予約料金の20':4A '当日で判断いたします':10A '当駐車場のキャンセル期限についてご案内いたします':1A
\.


--
-- Data for Name: KnowledgeQuestionVariation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."KnowledgeQuestionVariation" (id, knowledge_id, variation, created_at) FROM stdin;
\.


--
-- Data for Name: KnowledgeTag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."KnowledgeTag" (knowledge_id, tag_id) FROM stdin;
4	5
4	2
6	5
8	5
9	1
10	1
11	1
12	1
12	13
13	1
14	1
15	1
16	1
16	13
17	1
18	1
19	1
19	13
20	1
20	10
21	1
21	10
22	1
23	1
23	5
24	1
25	1
26	1
26	13
27	1
28	1
29	1
29	10
29	2
30	1
30	2
73	2
73	5
73	12
31	1
31	2
32	1
32	2
37	2
39	2
43	2
49	2
55	2
59	2
67	2
67	13
68	2
68	5
69	2
69	12
70	2
70	10
71	2
71	5
72	2
72	12
74	2
74	5
74	12
75	2
76	2
76	5
76	13
77	2
78	2
78	5
79	2
79	5
80	2
94	2
108	1
108	10
108	2
109	1
109	10
109	5
110	1
110	10
111	1
111	10
111	2
111	12
112	1
112	10
112	12
113	11
116	2
116	13
117	2
124	2
124	10
125	10
125	12
126	2
126	10
127	2
127	10
128	10
130	10
132	1
132	10
132	5
132	2
133	1
133	10
133	2
\.


--
-- Data for Name: ResponseLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ResponseLog" (id, query, response, used_knowledge_ids, missing_tags, missing_alerts, feedback, created_at, knowledge_id, response_count) FROM stdin;
1	キャンセルルール	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,112,111,110,109,108}	{}	{}	\N	2025-04-02 07:45:33.14	128	1
2	キャンセルルール	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,112,111,110,109,108}	{}	{}	\N	2025-04-02 07:45:33.147	128	1
3	予約日程	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,122,112,111,110,109}	{}	{}	\N	2025-04-02 07:46:23.493	128	1
4	予約日程	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,122,112,111,110,109}	{}	{}	\N	2025-04-02 07:46:23.497	128	1
5	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 07:46:40.43	128	1
6	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 07:46:40.435	128	1
7	キャンセルルール	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,112,111,110,109,108}	{}	{}	\N	2025-04-02 07:50:10.204	128	1
8	キャンセルルール	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,112,111,110,109,108}	{}	{}	\N	2025-04-02 07:50:10.215	128	1
9	予約日程	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,122,112,111,110,109}	{}	{}	\N	2025-04-02 07:50:19.058	128	1
10	予約日程	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,122,112,111,110,109}	{}	{}	\N	2025-04-02 07:50:19.062	128	1
11	予約日程	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,122,112,111,110,109}	{}	{}	\N	2025-04-02 07:50:27.833	128	1
12	予約日程	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,122,112,111,110,109}	{}	{}	\N	2025-04-02 07:50:27.841	128	1
13	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 07:50:37.973	128	1
14	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 07:50:37.978	128	1
15	キャンセルルール	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,112,111,110,109,108}	{}	{}	\N	2025-04-02 07:59:26.566	128	1
16	キャンセルルール	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,112,111,110,109,108}	{}	{}	\N	2025-04-02 07:59:26.573	128	1
17	予約日程	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,122,112,111,110,109}	{}	{}	\N	2025-04-02 07:59:33.535	128	1
18	予約日程	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,122,112,111,110,109}	{}	{}	\N	2025-04-02 07:59:33.539	128	1
19	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 07:59:45.869	128	1
20	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 07:59:45.872	128	1
21	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 08:10:20.403	128	1
22	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 08:10:20.412	128	1
23	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 08:10:43.771	128	1
24	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 08:10:43.775	128	1
25	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 08:11:10.301	128	1
26	駐車場の利用手順	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,121,120,119}	{}	{}	\N	2025-04-02 08:11:10.308	128	1
27	予約方法	メニューの「ご予約」ページからの24時間ネット予約のみとなります。電話、FAX、メールでのご予約は承っておりません。締切は利用日前日の22:00までです。	{1}	{}	{}	\N	2025-04-03 07:39:51.486	1	1
28	予約方法	メニューの「ご予約」ページからの24時間ネット予約のみとなります。電話、FAX、メールでのご予約は承っておりません。締切は利用日前日の22:00までです。	{1}	{}	{}	\N	2025-04-03 07:39:51.513	1	1
29	外車	外車は場内保険の対象外となるため、お預かりできかねます。	{88,89,40,35,87}	{}	{}	\N	2025-04-03 07:39:57.918	88	1
30	外車	お問い合わせありがとうございます。誠に申し訳ございませんが、当駐車場では場内保険の対象外となるため、全外車（BMW、ベンツ、アウディなどを含む）とレクサス全車種はお預かりできかねます。ご理解いただけますと幸いです。	{88,89,40,35,87}	{}	{}	\N	2025-04-03 07:39:57.921	88	1
31	国際線	当駐車場は国内線ご利用のお客様専用となっております。	{87,89,28,64,84,88}	{}	{}	\N	2025-04-03 07:40:03.075	87	1
32	国際線	申し訳ございませんが、当駐車場は国内線ご利用のお客様専用となっております。国際線ターミナルへの送迎も含め、ご利用いただけません。	{87,89,28,64,84,88}	{}	{}	\N	2025-04-03 07:40:03.081	87	1
33	キャンセル	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,108,70,112,111,126,127,124,128,125}	{}	{}	\N	2025-04-03 07:40:10.829	109	1
34	キャンセル	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,108,70,112,111,126,127,124,128,125}	{}	{}	\N	2025-04-03 07:40:10.832	109	1
35	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 07:40:21.695	110	1
36	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 07:40:21.698	110	1
37	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 07:40:58.487	128	1
38	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 07:40:58.49	128	1
39	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:02:00.66	128	1
40	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:02:00.666	128	1
41	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:02:51.387	128	1
42	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:02:51.392	128	1
43	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:05:11.426	128	1
44	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:05:11.43	128	1
45	予約方法	メニューの「ご予約」ページからの24時間ネット予約のみとなります。電話、FAX、メールでのご予約は承っておりません。締切は利用日前日の22:00までです。	{1}	{}	{}	\N	2025-04-03 08:05:57.144	1	1
46	予約方法	メニューの「ご予約」ページからの24時間ネット予約のみとなります。電話、FAX、メールでのご予約は承っておりません。締切は利用日前日の22:00までです。	{1}	{}	{}	\N	2025-04-03 08:05:57.149	1	1
47	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:06:04.731	128	1
48	予約変更	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:06:04.736	128	1
49	キャンセル	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,108,70,112,111,126,127,124,128,125}	{}	{}	\N	2025-04-03 08:11:55.161	109	1
50	キャンセル	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,108,70,112,111,126,127,124,128,125}	{}	{}	\N	2025-04-03 08:11:55.171	109	1
104	キャンセルの支払い	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:41:49.756	109	1
51	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 08:12:37.671	110	1
52	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 08:12:37.674	110	1
53	予約変更\n\n	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:15:33.021	128	1
54	予約変更\n\n	お問い合わせいただき、ありがとうございます。部分キャンセルに関するご意見、承りました。当駐車場では、予約システムの仕様上および公平な予約枠管理の観点から、複数日予約の部分キャンセルに対応しておりません。これは、部分的にキャンセルされた日程が断片的に空き状態となり、他のお客様に有効活用いただけなくなるためです。お客様には大変ご不便をおかけしますが、予約システムの安定運用と公平な予約枠の提供のため、現在の方針とさせていただいております。ご希望の日程でのご利用が可能となるよう、現在の予約をキャンセルいただき、改めてご希望日程での予約をご検討いただけますと幸いです。何卒ご理解とご協力をお願い申し上げます。	{128,127,126,125,124,123,122,114,112,111}	{}	{}	\N	2025-04-03 08:15:33.028	128	1
55	予約変更\n\n	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110,85,32,31,30,108}	{}	{}	\N	2025-04-03 08:19:30.746	110	1
56	予約変更\n\n	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110,85,32,31,30,108}	{}	{}	\N	2025-04-03 08:19:30.751	110	1
57	予約変更\n\n	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110,85,32,31,30,108}	{}	{}	\N	2025-04-03 08:20:15.498	110	1
58	予約変更\n\n	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110,85,32,31,30,108}	{}	{}	\N	2025-04-03 08:20:15.501	110	1
59	キャンセルしたい\n	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 08:21:07.985	110	1
60	キャンセルしたい\n	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 08:21:07.989	110	1
61	キャンセル\n	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,108,70,112,111,126,127,124,128,125}	{}	{}	\N	2025-04-03 08:21:16.782	109	1
62	キャンセル\n	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,108,70,112,111,126,127,124,128,125}	{}	{}	\N	2025-04-03 08:21:16.784	109	1
63	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,128,127,126,125,124}	{}	{}	\N	2025-04-03 08:45:06.045	112	1
64	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,128,127,126,125,124}	{}	{}	\N	2025-04-03 08:45:06.052	112	1
65	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,128,127,126,125,124}	{}	{}	\N	2025-04-03 08:47:52.22	112	1
66	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,128,127,126,125,124}	{}	{}	\N	2025-04-03 08:47:52.226	112	1
92	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:35:08.629	131	1
67	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 08:48:02.034	110	1
68	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 08:48:02.037	110	1
69	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,128,127,126,125,124}	{}	{}	\N	2025-04-03 08:58:37.531	112	1
70	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,128,127,126,125,124}	{}	{}	\N	2025-04-03 08:58:37.538	112	1
71	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 08:58:44.729	110	1
72	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 08:58:44.732	110	1
73	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,128,127,126,125,124}	{}	{}	\N	2025-04-03 08:59:05.703	112	1
74	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,128,127,126,125,124}	{}	{}	\N	2025-04-03 08:59:05.712	112	1
75	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:01:45.546	112	1
76	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:01:45.559	112	1
77	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:02:05.858	112	1
78	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:02:05.865	112	1
79	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:06:20.447	112	1
80	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:06:20.452	112	1
81	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:08:27.161	112	1
82	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:08:27.171	112	1
83	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 09:08:47.698	110	1
84	キャンセルしたい	お問い合わせいただき、ありがとうございます。誠に申し訳ございませんが、当駐車場では複数日のご予約について、一部の日程のみのキャンセルは承っておりません。部分的な日程変更をご希望の場合は、現在のご予約を一度全てキャンセルいただき、ご希望の日程で改めてご予約いただく必要がございます。その場合、既存の予約に対してはキャンセルポリシー（前日20%、当日50%）に基づくキャンセル料が発生いたします。また、再予約の際は、ご希望のすべての日程に空きがある場合のみご予約が可能となります。ご不便をおかけして申し訳ございませんが、ご理解いただけますようお願い申し上げます。	{110}	{}	{}	\N	2025-04-03 09:08:47.707	110	1
85	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:10:38.131	112	1
86	キャンセル	お問い合わせいただき、ありがとうございます。ご体調を崩されたとのこと、お見舞い申し上げます。当駐車場では、お客様の急病や怪我によるキャンセルにつきましても、基本的には規定のキャンセル料（前日20%、当日50%）を申し受けております。ただし、入院など、やむを得ない重篤な症状の場合は、診断書や入院証明書などの医療機関の証明書をご提出いただくことで、個別に検討させていただくことも可能です。該当の証明書をご提出いただけますでしょうか。お客様のご状況に配慮しつつも、公平な運営を維持するための対応となりますので、何卒ご理解とご協力をお願い申し上げます。	{112,111,110,109,108,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:10:38.135	112	1
87	キャンセル	当駐車場のキャンセルポリシーは以下の通りです。ご利用予定日の前日までのキャンセル：予約料金の20%、ご利用予定日当日のキャンセル：予約料金の50%をキャンセル料として申し受けます。お客様のご都合によるキャンセルにつきましても、上記のキャンセル料が発生いたしますので、ご了承ください。予約内容の変更やキャンセルをご希望の際は、できるだけ早めにご連絡いただけますようお願い申し上げます。	{108,109,112,111,110,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:27:37.26	108	1
88	キャンセル	当駐車場のキャンセルポリシーは以下の通りです。ご利用予定日の前日までのキャンセル：予約料金の20%、ご利用予定日当日のキャンセル：予約料金の50%をキャンセル料として申し受けます。お客様のご都合によるキャンセルにつきましても、上記のキャンセル料が発生いたしますので、ご了承ください。予約内容の変更やキャンセルをご希望の際は、できるだけ早めにご連絡いただけますようお願い申し上げます。	{108,109,112,111,110,29,70,126,127,124,128,125,21,20}	{}	{}	\N	2025-04-03 09:27:37.267	108	1
89	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:28:02.495	131	1
90	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:28:02.5	131	1
91	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:35:08.621	131	1
93	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:35:46.106	131	1
94	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:35:46.123	131	1
95	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:36:26.93	131	1
96	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:36:26.936	131	1
97	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:37:04.595	131	1
98	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:37:04.6	131	1
99	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:37:29.732	131	1
100	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:37:29.737	131	1
101	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:38:02.768	131	1
102	キャンセルの支払い	ご不満やご要望について責任者への取り次ぎをご希望とのこと、承知いたしました。責任者への取り次ぎについては、まず担当スタッフが状況を詳しくお伺いした上で、必要に応じて責任者に引き継がせていただいております。現在の責任者の在席状況や予定によっては、すぐにご対応できない場合もございますので、その際は改めてご連絡させていただくことになります。お客様のご要望とご連絡先をお伺いできますでしょうか。	{131,130,129,128,127}	{}	{}	\N	2025-04-03 09:38:02.796	131	1
103	キャンセルの支払い	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:41:49.751	109	1
105	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:42:25.067	109	1
106	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:42:25.076	109	1
107	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:42:27.23	109	1
108	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:42:27.234	109	1
109	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:42:34.148	109	1
110	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:42:34.151	109	1
111	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:42:41.949	109	1
112	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:42:41.957	109	1
113	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:45:01.022	109	1
114	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109}	{}	{}	\N	2025-04-03 09:45:01.05	109	1
115	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,126}	{}	{}	\N	2025-04-03 09:48:18.988	109	1
116	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,126}	{}	{}	\N	2025-04-03 09:48:18.994	109	1
117	キャンセルの方法	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:22:12.488	132	1
118	キャンセルの方法	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:22:12.497	132	1
119	キャンセルの支払いが	当駐車場のキャンセル期限についてご案内いたします。キャンセル料金の発生を最小限にするには、ご利用予定日の前々日までにキャンセルをお願いいたします。前日までのキャンセルは予約料金の20％、ご利用当日のキャンセルは50％のキャンセル料が発生いたします。なお、キャンセル手続きは24時間いつでも受け付けておりますが、キャンセル料の計算は予約開始時刻の前日・当日で判断いたします。例えば、5月10日14:00からの予約の場合、5月9日23:59までが前日キャンセル扱いとなります。できるだけ早めのご連絡をお願いいたします。	{133,132,131,130,129}	{}	{}	\N	2025-04-03 10:25:44.229	133	1
120	キャンセルの支払いが	当駐車場のキャンセル期限についてご案内いたします。キャンセル料金の発生を最小限にするには、ご利用予定日の前々日までにキャンセルをお願いいたします。前日までのキャンセルは予約料金の20％、ご利用当日のキャンセルは50％のキャンセル料が発生いたします。なお、キャンセル手続きは24時間いつでも受け付けておりますが、キャンセル料の計算は予約開始時刻の前日・当日で判断いたします。例えば、5月10日14:00からの予約の場合、5月9日23:59までが前日キャンセル扱いとなります。できるだけ早めのご連絡をお願いいたします。	{133,132,131,130,129}	{}	{}	\N	2025-04-03 10:25:44.233	133	1
121	キャンセルの支払い	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:25:56.558	132	1
122	キャンセルの支払い	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:25:56.561	132	1
123	キャンセルの支払い方法\n	当駐車場のキャンセル期限についてご案内いたします。キャンセル料金の発生を最小限にするには、ご利用予定日の前々日までにキャンセルをお願いいたします。前日までのキャンセルは予約料金の20％、ご利用当日のキャンセルは50％のキャンセル料が発生いたします。なお、キャンセル手続きは24時間いつでも受け付けておりますが、キャンセル料の計算は予約開始時刻の前日・当日で判断いたします。例えば、5月10日14:00からの予約の場合、5月9日23:59までが前日キャンセル扱いとなります。できるだけ早めのご連絡をお願いいたします。	{133,132,131,130,129}	{}	{}	\N	2025-04-03 10:26:30.515	133	1
124	キャンセルの支払い方法\n	当駐車場のキャンセル期限についてご案内いたします。キャンセル料金の発生を最小限にするには、ご利用予定日の前々日までにキャンセルをお願いいたします。前日までのキャンセルは予約料金の20％、ご利用当日のキャンセルは50％のキャンセル料が発生いたします。なお、キャンセル手続きは24時間いつでも受け付けておりますが、キャンセル料の計算は予約開始時刻の前日・当日で判断いたします。例えば、5月10日14:00からの予約の場合、5月9日23:59までが前日キャンセル扱いとなります。できるだけ早めのご連絡をお願いいたします。	{133,132,131,130,129}	{}	{}	\N	2025-04-03 10:26:30.518	133	1
125	キャンセルの方法\n	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:28:19.608	132	1
126	キャンセルの方法\n	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:28:19.614	132	1
127	キャンセルの支払い方法	当駐車場のキャンセル期限についてご案内いたします。キャンセル料金の発生を最小限にするには、ご利用予定日の前々日までにキャンセルをお願いいたします。前日までのキャンセルは予約料金の20％、ご利用当日のキャンセルは50％のキャンセル料が発生いたします。なお、キャンセル手続きは24時間いつでも受け付けておりますが、キャンセル料の計算は予約開始時刻の前日・当日で判断いたします。例えば、5月10日14:00からの予約の場合、5月9日23:59までが前日キャンセル扱いとなります。できるだけ早めのご連絡をお願いいたします。	{133,132,131,130,129}	{}	{}	\N	2025-04-03 10:29:24.242	133	1
128	キャンセルの支払い方法	当駐車場のキャンセル期限についてご案内いたします。キャンセル料金の発生を最小限にするには、ご利用予定日の前々日までにキャンセルをお願いいたします。前日までのキャンセルは予約料金の20％、ご利用当日のキャンセルは50％のキャンセル料が発生いたします。なお、キャンセル手続きは24時間いつでも受け付けておりますが、キャンセル料の計算は予約開始時刻の前日・当日で判断いたします。例えば、5月10日14:00からの予約の場合、5月9日23:59までが前日キャンセル扱いとなります。できるだけ早めのご連絡をお願いいたします。	{133,132,131,130,129}	{}	{}	\N	2025-04-03 10:29:24.246	133	1
129	キャンセルの支払い	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:32:57.584	132	1
130	キャンセルの支払い	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:32:57.587	132	1
131	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:33:05.818	132	1
132	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:33:05.821	132	1
133	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:45:10.592	132	1
134	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:45:10.602	132	1
135	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:46:01.12	132	1
136	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:46:01.128	132	1
137	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:52:13.304	132	1
138	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109}	{}	{}	\N	2025-04-03 10:52:13.311	132	2
139	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109,133,112,111,110,108,29,128,127,126,125,124,70,21,20}	{}	{}	\N	2025-04-03 11:03:25.268	132	1
140	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109,133,112,111,110,108,29,128,127,126,125,124,70,21,20}	{}	{}	\N	2025-04-03 11:03:25.277	132	16
141	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109,133,112,111,110,108,29,128,127,126,125,124,70,21,20}	{}	{}	\N	2025-04-03 11:03:31.184	132	1
142	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109,133,112,111,110,108,29,128,127,126,125,124,70,21,20}	{}	{}	\N	2025-04-03 11:03:31.187	132	16
143	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109,133,112,111,110,108,29,128,127,126,125,124,70,21,20}	{}	{}	\N	2025-04-03 11:04:12.134	132	1
144	キャンセルの支払	キャンセルのお手続きは以下の方法で承っております。1) お電話でのキャンセル: お電話いただき、予約番号とお名前をお伝えください。2) オンラインでのキャンセル: ご予約時にお送りした予約確認メールに返信または当駐車場のWeb「キャンセル連絡はこちら」からご連絡ください。キャンセル手続き完了後、確認メールをお送りいたします。なお、キャンセル料については規定（前日20%、当日50%）に基づいて発生し、キャンセル料金は振込でのお支払いとなります。キャンセル手続きについてご不明な点がございましたら、お気軽にお問い合わせください。	{132,109,133,112,111,110,108,29,128,127,126,125,124,70,21,20}	{}	{}	\N	2025-04-03 11:04:12.147	132	16
145	国際線の利用は可能ですか？	当駐車場は国内線ご利用のお客様専用となっております。	{87,64,84,89,88,28}	{}	{}	\N	2025-04-03 11:05:49.037	87	1
146	国際線の利用は可能ですか？	申し訳ございませんが、当駐車場は国内線ご利用のお客様専用となっております。国際線ターミナルへの送迎も含め、ご利用いただけません。	{87,64,84,89,88,28}	{}	{}	\N	2025-04-03 11:05:49.117	87	6
147	外車の駐車は可能ですか？	外車は場内保険の対象外となるため、お預かりできかねます。	{88,40,35,89,87}	{}	{}	\N	2025-04-03 11:05:52.377	88	1
148	外車の駐車は可能ですか？	お問い合わせありがとうございます。誠に申し訳ございませんが、当駐車場では場内保険の対象外となるため、全外車（BMW、ベンツ、アウディなどを含む）とレクサス全車種はお預かりできかねます。ご理解いただけますと幸いです。	{88,40,35,89,87}	{}	{}	\N	2025-04-03 11:05:52.38	88	5
149	予約方法を教えてください	メニューの「ご予約」ページからの24時間ネット予約のみとなります。電話、FAX、メールでのご予約は承っておりません。締切は利用日前日の22:00までです。	{1}	{}	{}	\N	2025-04-03 11:05:56.283	1	1
150	予約方法を教えてください	メニューの「ご予約」ページからの24時間ネット予約のみとなります。電話、FAX、メールでのご予約は承っておりません。締切は利用日前日の22:00までです。	{1}	{}	{}	\N	2025-04-03 11:05:56.286	1	1
151	キャンセルの支払	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,132,29,108,110,111,112,133,20,21,70,124,125,126,127,128}	{}	{}	\N	2025-04-03 11:06:43.69	109	16
152	キャンセルの方法	キャンセル料のお支払いは振込にてお願いしております。キャンセルが確定しましたら、キャンセル料の金額と振込先口座の情報をメールにてご案内いたします。お振込の際は、予約番号をお名前の前に記載いただけますとスムーズに確認ができます。なお、振込手数料はお客様のご負担となりますので、あらかじめご了承ください。ご不明な点がございましたら、お気軽にお問い合わせください。	{109,29,108,110,111,112,132,133,20,21,70,124,125,126,127,128}	{}	{}	\N	2025-04-03 11:07:14.719	109	16
\.


--
-- Data for Name: SearchHistory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SearchHistory" (id, query, category, tags, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SearchSynonym; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SearchSynonym" (id, word, synonym, created_at) FROM stdin;
1	駐車	駐車場	2025-04-02 06:38:05.622
2	駐車	パーキング	2025-04-02 06:38:05.622
3	予約	予約方法	2025-04-02 06:38:05.622
4	予約	予約手続き	2025-04-02 06:38:05.622
5	料金	価格	2025-04-02 06:38:05.622
6	料金	費用	2025-04-02 06:38:05.622
7	支払	支払い	2025-04-02 06:38:05.622
8	支払	精算	2025-04-02 06:38:05.622
9	車種	自動車	2025-04-02 06:38:05.622
10	車種	車	2025-04-02 06:38:05.622
13	予約	リザーブ	2025-04-02 06:38:05.636
14	予約	予約可能	2025-04-02 06:38:05.636
15	予約	予約状況	2025-04-02 06:38:05.636
18	料金	コスト	2025-04-02 06:38:05.636
19	料金	料金体系	2025-04-02 06:38:05.636
20	料金	料金表	2025-04-02 06:38:05.636
23	駐車	駐車可能	2025-04-02 06:38:05.636
24	駐車	駐車状況	2025-04-02 06:38:05.636
25	できますか	可能ですか	2025-04-02 06:38:05.636
26	できますか	利用できますか	2025-04-02 06:38:05.636
27	できますか	利用可能ですか	2025-04-02 06:38:05.636
28	いくらですか	料金はいくらですか	2025-04-02 06:38:05.636
29	いくらですか	費用はいくらですか	2025-04-02 06:38:05.636
30	いくらですか	価格はいくらですか	2025-04-02 06:38:05.636
31	1日	24時間	2025-04-02 06:38:05.636
32	1日	1泊	2025-04-02 06:38:05.636
33	1日	1日間	2025-04-02 06:38:05.636
34	1週間	7日間	2025-04-02 06:38:05.636
35	1週間	1週	2025-04-02 06:38:05.636
36	1週間	7日	2025-04-02 06:38:05.636
37	国際線	インターナショナル	2025-04-02 06:38:05.636
38	国際線	国際ターミナル	2025-04-02 06:38:05.636
39	国際線	国際便	2025-04-02 06:38:05.636
40	国内線	ドメスティック	2025-04-02 06:38:05.636
41	国内線	国内ターミナル	2025-04-02 06:38:05.636
42	国内線	国内便	2025-04-02 06:38:05.636
\.


--
-- Data for Name: SeasonalInfo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SeasonalInfo" (id, info_type, start_date, end_date, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: Tag; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Tag" (id, tag_name, description) FROM stdin;
1	予約	予約に関する情報
2	料金	料金に関する情報
3	駐車場	駐車場に関する情報
4	送迎	送迎に関する情報
5	支払い	支払いに関する情報
6	車種	車種に関する情報
7	繁忙期	繁忙期に関する情報
8	国際線	国際線に関する情報
9	国内線	国内線に関する情報
10	キャンセル	キャンセルに関する情報
11	営業時間	営業時間に関する情報
12	領収書	領収書に関する情報
13	割引	割引に関する情報
\.


--
-- Data for Name: TagSynonym; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TagSynonym" (id, tag_id, synonym) FROM stdin;
1	1	予約方法
2	1	予約手続き
3	1	リザーブ
4	1	申し込み
5	1	申込
6	1	予約する
7	2	価格
8	2	費用
9	2	コスト
10	2	値段
11	2	代金
12	2	金額
13	5	精算
14	5	会計
15	5	支払方法
16	5	決済
17	5	支払う
18	10	解約
19	10	取り消し
20	10	キャンセルする
21	11	営業
22	11	開店時間
23	11	閉店時間
24	11	営業日
25	3	パーキング
26	3	駐車
27	3	車置き場
28	6	自動車
29	6	車
30	6	車両
31	8	インターナショナル
32	8	国際便
33	9	ドメスティック
34	9	国内便
35	12	レシート
36	12	明細
37	12	証明書
38	13	クーポン
39	13	ディスカウント
40	13	特典
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
8c212ef9-2773-48f7-b775-6b2cc702a490	4c70af5cc75838ddb766b04839ba15ac2f30194db301770c36715692ec810bd7	2025-04-02 06:38:05.578872+00	20250306181223_init	\N	\N	2025-04-02 06:38:05.457308+00	1
9f15eadf-abfe-48c9-b346-7fb819a336da	0e00a2b1f88bbfded47135aa510a33ae0fbe99762fc796834e16163c9ff8b692	2025-04-02 06:38:05.591026+00	20250307094718_add_full_text_search	\N	\N	2025-04-02 06:38:05.581353+00	1
877a36e0-588b-40b0-babc-f4a385070e20	c48f5c68690ed316524ca3542a200a8193e588c2e02235912bd43b637da06dd2	2025-04-02 06:38:05.601529+00	20250310000000_create_search_synonym	\N	\N	2025-04-02 06:38:05.592966+00	1
e0ec15f3-946f-495a-9d11-fd47e989c214	34a03cf7b4fe0e5aae1753158267534c4658dc05feac5094b391aff602d97b78	2025-04-02 06:38:05.616723+00	20250310165641_	\N	\N	2025-04-02 06:38:05.604251+00	1
f0c0e6cd-cd2b-4662-bdf8-a5cb0ee65bc1	4a175e2678cfd77f87249aebd241bc005a58385a7b55f2534c8560fa96b25432	2025-04-02 06:38:05.627883+00	20250310_enhance_japanese_search	\N	\N	2025-04-02 06:38:05.619345+00	1
11a12384-93fe-4879-a8eb-cf866b5e0e17	aad53955927b84225ba9fd2d3a67a3d4d36f48a8c80c83d2e279f78d73ca7c16	2025-04-02 06:38:05.641458+00	20250311_update_search_weights	\N	\N	2025-04-02 06:38:05.63299+00	1
3f03885f-4be5-4781-a0af-737fb54a15fd	10610222bb22a316312febe2a251139b65ff972ae3a7e9fc3ce7167b0ae8d67c	2025-04-02 06:38:05.655986+00	20250320121509_fix_response_log_knowledge_relation	\N	\N	2025-04-02 06:38:05.643598+00	1
6ec2ebed-c42a-4108-9688-43d9f56ebcb4	a19e5296588cfeadcbcff4d1b36b8c4a5082eb28ccb9e84b4f91ba9c91f5612e	2025-04-02 06:38:05.673725+00	20250321112548_fix_tsvector_type	\N	\N	2025-04-02 06:38:05.659636+00	1
af29bc85-bdbc-4d4a-af23-eb3dad9b9cd7	1b675b07190b41e2072a35015f31bbf36b6fa34615f7fc2e112ef82a804fb31f	2025-04-02 06:38:05.684462+00	20250322071719_add_feedback_weight_composite_key	\N	\N	2025-04-02 06:38:05.675888+00	1
edc3b4e6-ab61-40fd-96da-76fe2b4d274c	d8d47d1da8470136b7ea07174ffbef99a2442b14311749b092fadf575711b048	2025-04-02 06:38:05.700854+00	20250323163109_add_question_variations	\N	\N	2025-04-02 06:38:05.686959+00	1
6564672e-a71e-40aa-adc4-a792462a9701	70d543eda922f3b289a70eab03f51604ac07d5aa00b14b09a9bba6c35a4d5ca8	2025-04-02 07:19:49.727166+00	20250402064604_add_custom_pgroonga_indexes		\N	2025-04-02 07:19:49.727166+00	0
\.


--
-- Name: AdminUser_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."AdminUser_id_seq"', 1, false);


--
-- Name: AlertWord_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."AlertWord_id_seq"', 1, false);


--
-- Name: KnowledgeQuestionVariation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."KnowledgeQuestionVariation_id_seq"', 1, false);


--
-- Name: Knowledge_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Knowledge_id_seq"', 133, true);


--
-- Name: ResponseLog_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ResponseLog_id_seq"', 152, true);


--
-- Name: SearchHistory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."SearchHistory_id_seq"', 1, false);


--
-- Name: SearchSynonym_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."SearchSynonym_id_seq"', 42, true);


--
-- Name: SeasonalInfo_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."SeasonalInfo_id_seq"', 1, false);


--
-- Name: TagSynonym_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."TagSynonym_id_seq"', 40, true);


--
-- Name: Tag_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Tag_id_seq"', 13, true);


--
-- Name: AdminUser AdminUser_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AdminUser"
    ADD CONSTRAINT "AdminUser_pkey" PRIMARY KEY (id);


--
-- Name: AlertWord AlertWord_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AlertWord"
    ADD CONSTRAINT "AlertWord_pkey" PRIMARY KEY (id);


--
-- Name: FeedbackWeight FeedbackWeight_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeedbackWeight"
    ADD CONSTRAINT "FeedbackWeight_pkey" PRIMARY KEY (query_pattern, knowledge_id);


--
-- Name: KnowledgeQuestionVariation KnowledgeQuestionVariation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KnowledgeQuestionVariation"
    ADD CONSTRAINT "KnowledgeQuestionVariation_pkey" PRIMARY KEY (id);


--
-- Name: KnowledgeTag KnowledgeTag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KnowledgeTag"
    ADD CONSTRAINT "KnowledgeTag_pkey" PRIMARY KEY (knowledge_id, tag_id);


--
-- Name: Knowledge Knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Knowledge"
    ADD CONSTRAINT "Knowledge_pkey" PRIMARY KEY (id);


--
-- Name: ResponseLog ResponseLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ResponseLog"
    ADD CONSTRAINT "ResponseLog_pkey" PRIMARY KEY (id);


--
-- Name: SearchHistory SearchHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SearchHistory"
    ADD CONSTRAINT "SearchHistory_pkey" PRIMARY KEY (id);


--
-- Name: SearchSynonym SearchSynonym_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SearchSynonym"
    ADD CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY (id);


--
-- Name: SeasonalInfo SeasonalInfo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SeasonalInfo"
    ADD CONSTRAINT "SeasonalInfo_pkey" PRIMARY KEY (id);


--
-- Name: TagSynonym TagSynonym_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TagSynonym"
    ADD CONSTRAINT "TagSynonym_pkey" PRIMARY KEY (id);


--
-- Name: Tag Tag_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tag"
    ADD CONSTRAINT "Tag_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AdminUser_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AdminUser_email_key" ON public."AdminUser" USING btree (email);


--
-- Name: AdminUser_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AdminUser_username_key" ON public."AdminUser" USING btree (username);


--
-- Name: AlertWord_word_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AlertWord_word_key" ON public."AlertWord" USING btree (word);


--
-- Name: FeedbackWeight_query_pattern_knowledge_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "FeedbackWeight_query_pattern_knowledge_id_key" ON public."FeedbackWeight" USING btree (query_pattern, knowledge_id);


--
-- Name: KnowledgeQuestionVariation_knowledge_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "KnowledgeQuestionVariation_knowledge_id_idx" ON public."KnowledgeQuestionVariation" USING btree (knowledge_id);


--
-- Name: KnowledgeQuestionVariation_variation_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "KnowledgeQuestionVariation_variation_idx" ON public."KnowledgeQuestionVariation" USING btree (variation);


--
-- Name: Knowledge_detail_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Knowledge_detail_category_idx" ON public."Knowledge" USING btree (detail_category);


--
-- Name: Knowledge_main_category_sub_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Knowledge_main_category_sub_category_idx" ON public."Knowledge" USING btree (main_category, sub_category);


--
-- Name: Knowledge_question_answer_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Knowledge_question_answer_idx" ON public."Knowledge" USING btree (question, answer);


--
-- Name: SearchHistory_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SearchHistory_category_idx" ON public."SearchHistory" USING btree (category);


--
-- Name: SearchHistory_query_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SearchHistory_query_idx" ON public."SearchHistory" USING btree (query);


--
-- Name: SearchHistory_tags_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SearchHistory_tags_idx" ON public."SearchHistory" USING btree (tags);


--
-- Name: SearchSynonym_word_synonym_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SearchSynonym_word_synonym_key" ON public."SearchSynonym" USING btree (word, synonym);


--
-- Name: TagSynonym_tag_id_synonym_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "TagSynonym_tag_id_synonym_key" ON public."TagSynonym" USING btree (tag_id, synonym);


--
-- Name: Tag_tag_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Tag_tag_name_key" ON public."Tag" USING btree (tag_name);


--
-- Name: knowledge_pgroonga_answer_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX knowledge_pgroonga_answer_idx ON public."Knowledge" USING pgroonga (answer) WITH (tokenizer='TokenMecab', normalizer='NormalizerAuto');


--
-- Name: knowledge_pgroonga_detail_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX knowledge_pgroonga_detail_category_idx ON public."Knowledge" USING pgroonga (detail_category) WITH (tokenizer='TokenMecab', normalizer='NormalizerAuto');


--
-- Name: knowledge_pgroonga_main_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX knowledge_pgroonga_main_category_idx ON public."Knowledge" USING pgroonga (main_category) WITH (tokenizer='TokenMecab', normalizer='NormalizerAuto');


--
-- Name: knowledge_pgroonga_question_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX knowledge_pgroonga_question_idx ON public."Knowledge" USING pgroonga (question) WITH (tokenizer='TokenMecab', normalizer='NormalizerAuto');


--
-- Name: knowledge_pgroonga_sub_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX knowledge_pgroonga_sub_category_idx ON public."Knowledge" USING pgroonga (sub_category) WITH (tokenizer='TokenMecab', normalizer='NormalizerAuto');


--
-- Name: knowledge_search_vector_gin_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX knowledge_search_vector_gin_idx ON public."Knowledge" USING gin (search_vector);


--
-- Name: Knowledge knowledge_vector_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER knowledge_vector_update BEFORE INSERT OR UPDATE ON public."Knowledge" FOR EACH ROW EXECUTE FUNCTION public.knowledge_search_trigger();


--
-- Name: AlertWord AlertWord_related_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AlertWord"
    ADD CONSTRAINT "AlertWord_related_tag_id_fkey" FOREIGN KEY (related_tag_id) REFERENCES public."Tag"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FeedbackWeight FeedbackWeight_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeedbackWeight"
    ADD CONSTRAINT "FeedbackWeight_knowledge_id_fkey" FOREIGN KEY (knowledge_id) REFERENCES public."Knowledge"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: KnowledgeQuestionVariation KnowledgeQuestionVariation_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KnowledgeQuestionVariation"
    ADD CONSTRAINT "KnowledgeQuestionVariation_knowledge_id_fkey" FOREIGN KEY (knowledge_id) REFERENCES public."Knowledge"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: KnowledgeTag KnowledgeTag_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KnowledgeTag"
    ADD CONSTRAINT "KnowledgeTag_knowledge_id_fkey" FOREIGN KEY (knowledge_id) REFERENCES public."Knowledge"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: KnowledgeTag KnowledgeTag_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KnowledgeTag"
    ADD CONSTRAINT "KnowledgeTag_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES public."Tag"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ResponseLog ResponseLog_knowledge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ResponseLog"
    ADD CONSTRAINT "ResponseLog_knowledge_id_fkey" FOREIGN KEY (knowledge_id) REFERENCES public."Knowledge"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TagSynonym TagSynonym_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TagSynonym"
    ADD CONSTRAINT "TagSynonym_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES public."Tag"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--


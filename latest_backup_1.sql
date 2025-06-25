--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 17.2

-- Started on 2025-06-23 13:36:14

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
-- TOC entry 3490 (class 1262 OID 16389)
-- Name: sna_db; Type: DATABASE; Schema: -; Owner: sna_db_user
--

CREATE DATABASE sna_db WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.UTF8';


ALTER DATABASE sna_db OWNER TO sna_db_user;

\connect sna_db

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
-- TOC entry 3491 (class 0 OID 0)
-- Name: sna_db; Type: DATABASE PROPERTIES; Schema: -; Owner: sna_db_user
--

ALTER DATABASE sna_db SET "TimeZone" TO 'utc';


\connect sna_db

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
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: sna_db_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO sna_db_user;

--
-- TOC entry 244 (class 1255 OID 16434)
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: sna_db_user
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_set_timestamp() OWNER TO sna_db_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 215 (class 1259 OID 16435)
-- Name: classes; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.classes (
    class_id integer NOT NULL,
    class_name character varying(50) NOT NULL,
    teacher_id integer
);


ALTER TABLE public.classes OWNER TO sna_db_user;

--
-- TOC entry 216 (class 1259 OID 16438)
-- Name: classes_class_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.classes_class_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_class_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3492 (class 0 OID 0)
-- Dependencies: 216
-- Name: classes_class_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.classes_class_id_seq OWNED BY public.classes.class_id;


--
-- TOC entry 217 (class 1259 OID 16439)
-- Name: exam_results; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.exam_results (
    result_id integer NOT NULL,
    student_id integer,
    exam_id integer,
    score numeric(5,2) NOT NULL,
    submission_date timestamp without time zone DEFAULT now(),
    answers jsonb,
    raw_score_obtained numeric(5,2),
    user_id integer,
    time_taken_seconds integer,
    total_possible_marks integer,
    exam_version_timestamp timestamp with time zone
);


ALTER TABLE public.exam_results OWNER TO sna_db_user;

--
-- TOC entry 218 (class 1259 OID 16445)
-- Name: exam_results_result_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exam_results_result_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_results_result_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3493 (class 0 OID 0)
-- Dependencies: 218
-- Name: exam_results_result_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exam_results_result_id_seq OWNED BY public.exam_results.result_id;


--
-- TOC entry 219 (class 1259 OID 16446)
-- Name: exam_sessions; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.exam_sessions (
    session_id integer NOT NULL,
    student_id integer,
    exam_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    user_id integer,
    answers jsonb,
    progress jsonb,
    time_remaining_seconds integer
);


ALTER TABLE public.exam_sessions OWNER TO sna_db_user;

--
-- TOC entry 220 (class 1259 OID 16451)
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exam_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_sessions_session_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3494 (class 0 OID 0)
-- Dependencies: 220
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exam_sessions_session_id_seq OWNED BY public.exam_sessions.session_id;


--
-- TOC entry 221 (class 1259 OID 16452)
-- Name: exams; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.exams (
    exam_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    duration_minutes integer NOT NULL,
    created_by integer,
    class_level character varying(50),
    class_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    start_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp with time zone,
    subject_id integer,
    exam_type character varying(50) DEFAULT 'MAIN_EXAM'::character varying NOT NULL,
    max_score integer DEFAULT 100 NOT NULL,
    term character varying(50),
    session character varying(50),
    is_locked boolean DEFAULT false NOT NULL,
    CONSTRAINT exams_exam_type_check CHECK (((exam_type)::text = ANY (ARRAY[('CA1'::character varying)::text, ('CA2'::character varying)::text, ('CA3'::character varying)::text, ('CA4'::character varying)::text, ('MID_TERM'::character varying)::text, ('MAIN_EXAM'::character varying)::text, ('OTHER_CA'::character varying)::text]))),
    CONSTRAINT exams_term_check CHECK (((term)::text = ANY (ARRAY[('FIRST'::character varying)::text, ('SECOND'::character varying)::text, ('THIRD'::character varying)::text])))
);


ALTER TABLE public.exams OWNER TO sna_db_user;

--
-- TOC entry 222 (class 1259 OID 16465)
-- Name: exams_exam_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exams_exam_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exams_exam_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3495 (class 0 OID 0)
-- Dependencies: 222
-- Name: exams_exam_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exams_exam_id_seq OWNED BY public.exams.exam_id;


--
-- TOC entry 223 (class 1259 OID 16466)
-- Name: questions; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.questions (
    question_id integer NOT NULL,
    exam_id integer,
    question_text text NOT NULL,
    option_a character varying(255),
    option_b character varying(255),
    option_c character varying(255),
    option_d character varying(255),
    correct_answer character(1) NOT NULL,
    options jsonb,
    explanation text,
    marks integer DEFAULT 1 NOT NULL,
    user_id integer
);


ALTER TABLE public.questions OWNER TO sna_db_user;

--
-- TOC entry 224 (class 1259 OID 16472)
-- Name: questions_question_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.questions_question_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.questions_question_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3496 (class 0 OID 0)
-- Dependencies: 224
-- Name: questions_question_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.questions_question_id_seq OWNED BY public.questions.question_id;


--
-- TOC entry 225 (class 1259 OID 16473)
-- Name: report_card_meta; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.report_card_meta (
    report_id integer NOT NULL,
    student_id integer NOT NULL,
    term character varying(10) NOT NULL,
    session character varying(9) NOT NULL,
    teacher_comment text,
    principal_comment text,
    next_term_begins date,
    class_position character varying(10),
    affective_domain jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cumulative_data jsonb,
    class_level character varying(255)
);


ALTER TABLE public.report_card_meta OWNER TO sna_db_user;

--
-- TOC entry 226 (class 1259 OID 16480)
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.report_card_meta_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.report_card_meta_report_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3497 (class 0 OID 0)
-- Dependencies: 226
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.report_card_meta_report_id_seq OWNED BY public.report_card_meta.report_id;


--
-- TOC entry 232 (class 1259 OID 16603)
-- Name: results; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.results (
    id integer NOT NULL,
    user_id integer,
    score integer,
    total integer,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.results OWNER TO sna_db_user;

--
-- TOC entry 231 (class 1259 OID 16602)
-- Name: results_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.results_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3498 (class 0 OID 0)
-- Dependencies: 231
-- Name: results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.results_id_seq OWNED BY public.results.id;


--
-- TOC entry 227 (class 1259 OID 16481)
-- Name: subjects; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.subjects (
    subject_id integer NOT NULL,
    name character varying(255) NOT NULL,
    subject_code character varying(50)
);


ALTER TABLE public.subjects OWNER TO sna_db_user;

--
-- TOC entry 228 (class 1259 OID 16484)
-- Name: subjects_subject_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.subjects_subject_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subjects_subject_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3499 (class 0 OID 0)
-- Dependencies: 228
-- Name: subjects_subject_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.subjects_subject_id_seq OWNED BY public.subjects.subject_id;


--
-- TOC entry 229 (class 1259 OID 16485)
-- Name: users; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    is_admin boolean DEFAULT false,
    role character varying(20) DEFAULT 'student'::character varying NOT NULL,
    admission_number character varying(50),
    class_level character varying(50),
    first_name character varying(255),
    last_name character varying(255),
    profile_picture_url text,
    dob date,
    gender character varying(10),
    updated_at timestamp without time zone,
    class_id integer,
    CONSTRAINT class_level_for_students_only CHECK (((((role)::text = 'student'::text) AND (class_level IS NOT NULL) AND ((class_level)::text <> ''::text)) OR (((role)::text <> 'student'::text) AND (class_level IS NULL))))
);


ALTER TABLE public.users OWNER TO sna_db_user;

--
-- TOC entry 230 (class 1259 OID 16494)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3500 (class 0 OID 0)
-- Dependencies: 230
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3248 (class 2604 OID 16495)
-- Name: classes class_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes ALTER COLUMN class_id SET DEFAULT nextval('public.classes_class_id_seq'::regclass);


--
-- TOC entry 3249 (class 2604 OID 16496)
-- Name: exam_results result_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results ALTER COLUMN result_id SET DEFAULT nextval('public.exam_results_result_id_seq'::regclass);


--
-- TOC entry 3251 (class 2604 OID 16497)
-- Name: exam_sessions session_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions ALTER COLUMN session_id SET DEFAULT nextval('public.exam_sessions_session_id_seq'::regclass);


--
-- TOC entry 3252 (class 2604 OID 16498)
-- Name: exams exam_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams ALTER COLUMN exam_id SET DEFAULT nextval('public.exams_exam_id_seq'::regclass);


--
-- TOC entry 3259 (class 2604 OID 16499)
-- Name: questions question_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions ALTER COLUMN question_id SET DEFAULT nextval('public.questions_question_id_seq'::regclass);


--
-- TOC entry 3261 (class 2604 OID 16500)
-- Name: report_card_meta report_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta ALTER COLUMN report_id SET DEFAULT nextval('public.report_card_meta_report_id_seq'::regclass);


--
-- TOC entry 3269 (class 2604 OID 16606)
-- Name: results id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.results ALTER COLUMN id SET DEFAULT nextval('public.results_id_seq'::regclass);


--
-- TOC entry 3264 (class 2604 OID 16501)
-- Name: subjects subject_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects ALTER COLUMN subject_id SET DEFAULT nextval('public.subjects_subject_id_seq'::regclass);


--
-- TOC entry 3265 (class 2604 OID 16502)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3467 (class 0 OID 16435)
-- Dependencies: 215
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--



--
-- TOC entry 3469 (class 0 OID 16439)
-- Dependencies: 217
-- Data for Name: exam_results; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exam_results VALUES (6, 18, 17, 66.67, '2025-06-22 05:44:34.429971', '{"43": "a", "44": "b", "45": "b"}', 8.00, NULL, 103, 12, '2025-06-20 19:49:51.578+00');
INSERT INTO public.exam_results VALUES (4, 18, 16, 100.00, '2025-06-22 12:33:08.114839', '{"52": "c", "53": "d"}', 10.00, NULL, 30, 10, '2025-06-22 09:34:30.406+00');
INSERT INTO public.exam_results VALUES (5, 18, 15, 30.00, '2025-06-22 12:36:52.994717', '{"54": "d", "55": "b"}', 3.00, NULL, 31, 10, '2025-06-22 09:34:58.298+00');
INSERT INTO public.exam_results VALUES (11, 20, 17, 100.00, '2025-06-22 12:39:08.289272', '{"43": "a", "44": "b", "45": "d"}', 12.00, NULL, 28, 12, '2025-06-20 19:49:51.578+00');
INSERT INTO public.exam_results VALUES (12, 20, 18, 80.00, '2025-06-22 13:00:53.459164', '{"62": "a", "63": "c"}', 8.00, NULL, 71, 10, '2025-06-22 12:59:07.368+00');
INSERT INTO public.exam_results VALUES (13, 20, 19, 60.00, '2025-06-22 17:38:07.387722', '{"81": "b", "82": "a"}', 3.00, NULL, 29, 5, '2025-06-22 17:36:31.838+00');
INSERT INTO public.exam_results VALUES (15, 20, 15, 100.00, '2025-06-22 17:40:17.5734', '{"83": "b", "84": "b"}', 10.00, NULL, 13, 10, '2025-06-22 17:39:27.487+00');


--
-- TOC entry 3471 (class 0 OID 16446)
-- Dependencies: 219
-- Data for Name: exam_sessions; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exam_sessions VALUES (7, 18, 15, '2025-06-08 12:53:18.025212', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.exam_sessions VALUES (22, NULL, 17, '2025-06-20 19:54:43.894214', '2025-06-22 05:44:34.429971', 18, NULL, NULL, 0);
INSERT INTO public.exam_sessions VALUES (30, NULL, 16, '2025-06-22 12:32:35.742862', '2025-06-22 12:33:08.114839', 18, NULL, NULL, 0);
INSERT INTO public.exam_sessions VALUES (32, NULL, 15, '2025-06-22 12:36:21.037473', '2025-06-22 12:36:52.994717', 18, NULL, NULL, 0);
INSERT INTO public.exam_sessions VALUES (25, NULL, 17, '2025-06-20 22:09:06.570273', '2025-06-22 12:39:08.289272', 20, NULL, NULL, 0);
INSERT INTO public.exam_sessions VALUES (33, NULL, 18, '2025-06-22 12:59:41.351681', '2025-06-22 13:00:53.459164', 20, NULL, NULL, 0);
INSERT INTO public.exam_sessions VALUES (35, NULL, 16, '2025-06-22 14:25:53.192366', NULL, 22, NULL, NULL, 120);
INSERT INTO public.exam_sessions VALUES (36, NULL, 19, '2025-06-22 17:37:16.085165', '2025-06-22 17:38:07.387722', 20, NULL, NULL, 0);
INSERT INTO public.exam_sessions VALUES (37, NULL, 15, '2025-06-22 17:40:03.68654', '2025-06-22 17:40:17.5734', 20, NULL, NULL, 0);


--
-- TOC entry 3473 (class 0 OID 16452)
-- Dependencies: 221
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exams VALUES (18, 'English C.A 1', 'Read the questions carefully and answer them correctly', 2, 19, 'Primary 1', NULL, '2025-06-22 12:53:26.745533+00', '2025-06-22 14:19:05.052927+00', '2025-06-22 12:53:26.745533+00', NULL, 35, 'CA1', 10, 'FIRST', '2024-2025', true);
INSERT INTO public.exams VALUES (16, 'Mathematics MD TERM TEST', 'Read carefully before answering', 2, 6, 'Primary 1', NULL, '2025-06-09 06:11:53.422502+00', '2025-06-22 14:26:44.666888+00', '2025-06-09 06:11:53.422502+00', NULL, 1, 'CA1', 10, 'FIRST', '2024-2025', true);
INSERT INTO public.exams VALUES (17, 'Maths', 'Atempt all', 2, 19, 'Primary 1', NULL, '2025-06-20 19:49:51.578224+00', '2025-06-22 14:26:58.4837+00', '2025-06-20 19:49:51.578224+00', NULL, 1, 'CA3', 12, 'FIRST', '2024-2025', true);
INSERT INTO public.exams VALUES (19, 'Maths exam', 'Answer all', 1, 6, 'Primary 1', NULL, '2025-06-22 13:06:15.683178+00', '2025-06-22 17:36:31.838419+00', '2025-06-22 13:06:15.683178+00', NULL, 1, 'MAIN_EXAM', 5, 'FIRST', '2024-2025', false);
INSERT INTO public.exams VALUES (15, 'Mathematics MD TERM TEST', 'ATTEMPT ALL', 2, 1, 'Primary 1', NULL, '2025-06-08 11:22:26.201653+00', '2025-06-22 17:39:27.487019+00', '2025-06-08 11:22:26.201653+00', NULL, 1, 'CA2', 10, 'FIRST', '2024-2025', false);


--
-- TOC entry 3475 (class 0 OID 16466)
-- Dependencies: 223
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.questions VALUES (68, 18, 'Fill in the gap with the appropriate option

You and _____ are not friends', 'Me', 'Them', 'Us', 'I', 'D', NULL, '', 2, NULL);
INSERT INTO public.questions VALUES (69, 18, 'Wale, Sule and I _____ not going to work today', 'am', 'are', 'is', 'None of the options are correct', 'A', NULL, '', 6, NULL);
INSERT INTO public.questions VALUES (70, 18, 'Choose the word that best describe the opposite of the quoted word


She was ''above'' in all her exam', 'Good', 'Best', 'Below', 'Poor', 'C', NULL, '', 2, NULL);
INSERT INTO public.questions VALUES (76, 16, 'i have 8 oranges, if i share it between 4 of my brothers, how many should each receive?', '1', '3', '2', '4', 'C', NULL, '', 5, NULL);
INSERT INTO public.questions VALUES (77, 16, 'find the difference between 37 and 27', '64', '0', '40', '10', 'D', NULL, '', 5, NULL);
INSERT INTO public.questions VALUES (78, 17, '2x + 5 = 13, find x', '4', '3', '2', 'None e is correct', 'A', NULL, '', 4, NULL);
INSERT INTO public.questions VALUES (79, 17, 'Approximate 200.57 to the nearest whole number', '200', '201', '200.0', '210.0', 'B', NULL, '', 4, NULL);
INSERT INTO public.questions VALUES (80, 17, 'Twice 2 divided by quarter of it result is?', '2', '1', '0', '4', 'D', NULL, '', 4, NULL);
INSERT INTO public.questions VALUES (81, 19, 'Add 5 to twice 2', '6', '9', '7', '20', 'B', NULL, '', 3, NULL);
INSERT INTO public.questions VALUES (82, 19, 'Divide 9 by the smallest prime number, we have?', '3', '0', '9', '4.5', 'C', NULL, '', 2, NULL);
INSERT INTO public.questions VALUES (83, 15, '23 + 7 is', '70', '12', '35', '30', 'B', NULL, '', 7, NULL);
INSERT INTO public.questions VALUES (84, 15, '3 X 15', '20', '45', '315', '35', 'B', NULL, '', 3, NULL);


--
-- TOC entry 3477 (class 0 OID 16473)
-- Dependencies: 225
-- Data for Name: report_card_meta; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--



--
-- TOC entry 3484 (class 0 OID 16603)
-- Dependencies: 232
-- Data for Name: results; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--



--
-- TOC entry 3479 (class 0 OID 16481)
-- Dependencies: 227
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.subjects VALUES (11, 'Islamic Studies', 'IRS-PRY');
INSERT INTO public.subjects VALUES (1, 'Mathematics', 'MTH-PRY');
INSERT INTO public.subjects VALUES (13, 'Civic education ', 'CIV-PRY');
INSERT INTO public.subjects VALUES (3, 'Basic Science', 'BST-PRY');
INSERT INTO public.subjects VALUES (9, 'Computer Studies', 'ICT-PRY');
INSERT INTO public.subjects VALUES (4, 'Social Studies', 'SOS-PRY');
INSERT INTO public.subjects VALUES (14, 'Yoruba', 'YOR-PRY');
INSERT INTO public.subjects VALUES (15, 'HOME ECONOMICS', 'H/ECONS-PRY');
INSERT INTO public.subjects VALUES (16, 'AGRICULTURAL SCIENCE', 'AGRIC-PRY');
INSERT INTO public.subjects VALUES (17, 'CREATIVE AND CULTURAL ARTS', 'CCA-PRY');
INSERT INTO public.subjects VALUES (18, 'PHYSICAL AND HEALTH EDUCATION ', 'PHE-PRY');
INSERT INTO public.subjects VALUES (19, 'HANDWRITING', 'H/W-PRY');
INSERT INTO public.subjects VALUES (20, 'ARABIC LANGUAGE', 'ARA-PRY');
INSERT INTO public.subjects VALUES (21, 'QURAN', 'QUR-PRY');
INSERT INTO public.subjects VALUES (22, 'LITERACY AND COMMUNICATION', 'LIT/COMM-PS');
INSERT INTO public.subjects VALUES (23, 'NUMERACY/MATHS', 'N/M-PS');
INSERT INTO public.subjects VALUES (24, 'ASS', 'ASS-PS');
INSERT INTO public.subjects VALUES (25, 'SED', 'SED-PS');
INSERT INTO public.subjects VALUES (26, 'SHD', 'SHD-PS');
INSERT INTO public.subjects VALUES (27, 'CCA', 'CCA-PS');
INSERT INTO public.subjects VALUES (28, 'CHL', 'CHL-PS');
INSERT INTO public.subjects VALUES (29, 'H/WRITING', 'H/W-PS');
INSERT INTO public.subjects VALUES (30, 'DISCOVERY', 'DIS-PS');
INSERT INTO public.subjects VALUES (31, 'STORY', 'STO-PS');
INSERT INTO public.subjects VALUES (32, 'PRE-SCIENCE', 'PRE-SC-PS');
INSERT INTO public.subjects VALUES (33, 'S.T.L/F', 'STL/F-PS');
INSERT INTO public.subjects VALUES (34, 'SONG AND RHYME', 'S/R-PS');
INSERT INTO public.subjects VALUES (35, 'ENGLISH LANGUAGE', 'ENG-SEC');
INSERT INTO public.subjects VALUES (2, 'ENGLISH STUDIES', 'ENG-PRY');
INSERT INTO public.subjects VALUES (36, 'MATHEMATICS', 'MATHS-SEC');
INSERT INTO public.subjects VALUES (37, 'CHEMISTRY', 'CHEM-SEC');
INSERT INTO public.subjects VALUES (38, 'PHYSICS', 'PHY-SEC');
INSERT INTO public.subjects VALUES (40, 'FURTHER MATHS', 'F/MATHS-SEC');
INSERT INTO public.subjects VALUES (41, 'TECHNICAL DRAWING', 'TD-SEC');
INSERT INTO public.subjects VALUES (42, 'CIVIC EDUCATION', 'CIV-SEC 2');
INSERT INTO public.subjects VALUES (43, 'ECONOMICS', 'ECONS-SEC');
INSERT INTO public.subjects VALUES (44, 'FINANCIAL ACCOUNT', 'F/ACC-SEC');
INSERT INTO public.subjects VALUES (45, 'COMMERCE', 'COMM-SEC');
INSERT INTO public.subjects VALUES (46, 'DATA PROCESSING ', 'DATA PRO-SEC');
INSERT INTO public.subjects VALUES (47, 'MARKETING', 'MKT-SEC');
INSERT INTO public.subjects VALUES (48, 'BOOK KEEPING', 'BK-SEC');
INSERT INTO public.subjects VALUES (39, 'BIOLOGY', 'BIO-SEC');
INSERT INTO public.subjects VALUES (49, 'YORUBA', 'YOR-SEC 2');
INSERT INTO public.subjects VALUES (50, 'IRS', 'IRS-SEC 2');
INSERT INTO public.subjects VALUES (51, 'LITERATURE-IN-ENGLISH', 'LIT-SEC');
INSERT INTO public.subjects VALUES (52, 'ENGLISH STDS', 'ENG-SEC 1');
INSERT INTO public.subjects VALUES (53, 'MATHS', 'MATHS-SEC 1');
INSERT INTO public.subjects VALUES (54, 'BST', 'BST-SEC 1');
INSERT INTO public.subjects VALUES (55, 'CIVIC EDUCATION ', 'CIV-SEC 1');
INSERT INTO public.subjects VALUES (56, 'BUSINESS STDS', 'BUS-SEC 1');
INSERT INTO public.subjects VALUES (57, 'AGRIC SCIENCE', 'AGRIC-SEC 1');
INSERT INTO public.subjects VALUES (58, 'HOME ECONS', 'H/ECONS-SEC1');
INSERT INTO public.subjects VALUES (59, 'PHE', 'PHE-SEC 1');
INSERT INTO public.subjects VALUES (66, 'CREATICE AND CULTURAL A', 'CCA-SEC 1');
INSERT INTO public.subjects VALUES (67, 'YORUBA LANGUAGE', 'YOR-SEC 1');
INSERT INTO public.subjects VALUES (68, 'ICT', 'ICT-SEC 1');
INSERT INTO public.subjects VALUES (69, 'ARA LANGUAGE', 'ARA-SEC 1');
INSERT INTO public.subjects VALUES (70, 'QURAN STDS', 'QUR-SEC 1');


--
-- TOC entry 3481 (class 0 OID 16485)
-- Dependencies: 229
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.users VALUES (6, 'Abdullah', 'ishola2023m@gmail.com', '$2a$12$U4m7dPwPghPXVABPRIpadONJNoJGkP2cqvfr7lNhL3HTBpIfR4JNC', '2025-06-02 12:54:01.221605', true, 'admin', NULL, NULL, 'Abdullah', 'Abdlateef', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.users VALUES (15, 'khadijah', 'abdlateefkhadijah@gmail.com', '$2b$10$zQG388LFxfkrRXEjfDThB.Y.NoWjQYzyjJPK1oKXkquL0RFiVWKKW', '2025-06-05 15:22:56.261559', false, 'teacher', NULL, NULL, 'khadijah', 'Abdlateef', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.users VALUES (19, 'Summy', 'abdulateefsumayah@gmail.com', '$2b$10$a/GPU7qlzXKzMJiABKkIXOxUZ638usfyuzODNGpnnwErOkTCzBSpm', '2025-06-20 17:07:39.942112', false, 'teacher', NULL, NULL, 'Sumayah', 'Abdulateef ', NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.users VALUES (18, 'Atiyah', 'ijh@gmail.com', '$2b$10$ErNkxCS8mfdUM3kCboAIf.z7lr2Fo4uW3aarVUf79z86V0YS6zGcm', '2025-06-08 12:20:06.023402', false, 'student', 'SNA/22/001', 'Primary 1', 'Atiyah', 'Abdulateef', NULL, '2015-02-11', 'Female', '2025-06-20 19:41:36.170599', NULL);
INSERT INTO public.users VALUES (20, 'Abdullahi ', 'abdullhi@gmail.com', '$2b$10$Tv.JGLjjCd.nSVivyOphE.56osdEVGP9T5rEiIAW1INrab7IY0Sv6', '2025-06-20 19:18:40.414474', false, 'student', 'SNA/20/001', 'Primary 1', 'Abdullahi ', 'Salisu', NULL, '2022-07-04', 'Male', '2025-06-20 19:44:35.349415', NULL);
INSERT INTO public.users VALUES (1, 'Abu Sumayah', 'sealednec@gmail.com', '$2b$10$emRsyZpIs6iffDHa.FEj1.iOTLjF/kcZXsEKKN8hRrykhRvanoqN.', '2025-06-01 22:42:59.865333', true, 'admin', NULL, NULL, 'Abu', 'Sumayah', NULL, NULL, 'Male', '2025-06-22 04:45:50.331474', NULL);
INSERT INTO public.users VALUES (22, 'MARYAM', 'maryam@gmail.com', '$2b$10$fZqhtEfSzbJGeJuB1K76eeKHWIOsGr34VZU9tBgsGzoP21VOhxuJG', '2025-06-22 14:24:51.978925', false, 'student', 'SNA/25/001', 'Primary 1', 'Maryam', 'Abdlateef ', NULL, '2020-04-04', 'Female', NULL, NULL);


--
-- TOC entry 3501 (class 0 OID 0)
-- Dependencies: 216
-- Name: classes_class_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.classes_class_id_seq', 1, false);


--
-- TOC entry 3502 (class 0 OID 0)
-- Dependencies: 218
-- Name: exam_results_result_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exam_results_result_id_seq', 15, true);


--
-- TOC entry 3503 (class 0 OID 0)
-- Dependencies: 220
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exam_sessions_session_id_seq', 37, true);


--
-- TOC entry 3504 (class 0 OID 0)
-- Dependencies: 222
-- Name: exams_exam_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exams_exam_id_seq', 19, true);


--
-- TOC entry 3505 (class 0 OID 0)
-- Dependencies: 224
-- Name: questions_question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.questions_question_id_seq', 84, true);


--
-- TOC entry 3506 (class 0 OID 0)
-- Dependencies: 226
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.report_card_meta_report_id_seq', 1, false);


--
-- TOC entry 3507 (class 0 OID 0)
-- Dependencies: 231
-- Name: results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.results_id_seq', 1, false);


--
-- TOC entry 3508 (class 0 OID 0)
-- Dependencies: 228
-- Name: subjects_subject_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.subjects_subject_id_seq', 70, true);


--
-- TOC entry 3509 (class 0 OID 0)
-- Dependencies: 230
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.users_id_seq', 22, true);


--
-- TOC entry 3275 (class 2606 OID 16504)
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (class_id);


--
-- TOC entry 3277 (class 2606 OID 16506)
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (result_id);


--
-- TOC entry 3281 (class 2606 OID 16508)
-- Name: exam_sessions exam_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_pkey PRIMARY KEY (session_id);


--
-- TOC entry 3285 (class 2606 OID 16510)
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (exam_id);


--
-- TOC entry 3287 (class 2606 OID 16512)
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (question_id);


--
-- TOC entry 3289 (class 2606 OID 16514)
-- Name: report_card_meta report_card_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_pkey PRIMARY KEY (report_id);


--
-- TOC entry 3291 (class 2606 OID 16516)
-- Name: report_card_meta report_card_meta_student_id_term_session_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_term_session_key UNIQUE (student_id, term, session);


--
-- TOC entry 3307 (class 2606 OID 16609)
-- Name: results results_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_pkey PRIMARY KEY (id);


--
-- TOC entry 3293 (class 2606 OID 16518)
-- Name: subjects subjects_name_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_name_key UNIQUE (name);


--
-- TOC entry 3295 (class 2606 OID 16520)
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (subject_id);


--
-- TOC entry 3297 (class 2606 OID 16522)
-- Name: subjects subjects_subject_code_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_subject_code_key UNIQUE (subject_code);


--
-- TOC entry 3279 (class 2606 OID 16524)
-- Name: exam_results unique_student_exam; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT unique_student_exam UNIQUE (student_id, exam_id);


--
-- TOC entry 3283 (class 2606 OID 16526)
-- Name: exam_sessions unique_user_exam_session; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT unique_user_exam_session UNIQUE (user_id, exam_id);


--
-- TOC entry 3299 (class 2606 OID 16528)
-- Name: users users_admission_number_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_admission_number_key UNIQUE (admission_number);


--
-- TOC entry 3301 (class 2606 OID 16530)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3303 (class 2606 OID 16532)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3305 (class 2606 OID 16534)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3323 (class 2620 OID 16535)
-- Name: exams set_exam_timestamp; Type: TRIGGER; Schema: public; Owner: sna_db_user
--

CREATE TRIGGER set_exam_timestamp BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- TOC entry 3308 (class 2606 OID 16537)
-- Name: classes classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- TOC entry 3309 (class 2606 OID 16542)
-- Name: exam_results exam_results_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3310 (class 2606 OID 16547)
-- Name: exam_results exam_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_user_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- TOC entry 3311 (class 2606 OID 16552)
-- Name: exam_results exam_results_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3312 (class 2606 OID 16557)
-- Name: exam_sessions exam_sessions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3313 (class 2606 OID 16562)
-- Name: exam_sessions exam_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3314 (class 2606 OID 16567)
-- Name: exam_sessions exam_sessions_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3315 (class 2606 OID 16572)
-- Name: exams exams_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(class_id);


--
-- TOC entry 3316 (class 2606 OID 16577)
-- Name: exams exams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3317 (class 2606 OID 16582)
-- Name: exams exams_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id);


--
-- TOC entry 3321 (class 2606 OID 16615)
-- Name: users fk_class; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_class FOREIGN KEY (class_id) REFERENCES public.classes(class_id) ON DELETE SET NULL;


--
-- TOC entry 3318 (class 2606 OID 16587)
-- Name: questions questions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3319 (class 2606 OID 16592)
-- Name: questions questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3320 (class 2606 OID 16597)
-- Name: report_card_meta report_card_meta_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3322 (class 2606 OID 16610)
-- Name: results results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 2080 (class 826 OID 16391)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO sna_db_user;


--
-- TOC entry 2082 (class 826 OID 16393)
-- Name: DEFAULT PRIVILEGES FOR TYPES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO sna_db_user;


--
-- TOC entry 2081 (class 826 OID 16392)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO sna_db_user;


--
-- TOC entry 2079 (class 826 OID 16390)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO sna_db_user;


-- Completed on 2025-06-23 13:36:57

--
-- PostgreSQL database dump complete
--


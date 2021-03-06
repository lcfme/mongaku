// @flow

const React = require("react");

import type {Context} from "./types.js";
const {childContextTypes} = require("./Wrapper.js");

type Props = {
    children?: React.Node,
};

const Logo = (props, {options, STATIC}: Context) => {
    if (!options.logo) {
        return null;
    }

    return (
        <span>
            <img
                alt={options.getTitle}
                src={STATIC(options.logo)}
                height="40"
                width="40"
            />{" "}
        </span>
    );
};

Logo.contextTypes = childContextTypes;

class Dropdown extends React.PureComponent<
    {
        children?: React.Node,
        title: React.Node,
        href?: string,
    },
    {open: boolean},
> {
    constructor(props) {
        super(props);
        this.state = {open: false};
    }

    componentDidMount() {
        this.boundHandleBlur = (e: Event) => this.handleBlur(e);
        document.addEventListener("focusin", this.boundHandleBlur);
        document.addEventListener("click", this.boundHandleBlur);
    }

    componentWillUnmount() {
        document.removeEventListener("focusin", this.boundHandleBlur);
        document.removeEventListener("click", this.boundHandleBlur);
    }

    dropdown: ?Element;
    boundHandleBlur: (e: Event) => void;

    handleToggle(e: SyntheticMouseEvent<HTMLAnchorElement>) {
        e.preventDefault();
        this.setState({
            open: !this.state.open,
        });
    }

    handleBlur(e: Event) {
        const {target} = e;

        if (
            !target ||
            (target instanceof Node &&
                this.dropdown &&
                !this.dropdown.contains(target))
        ) {
            this.setState({
                open: false,
            });
        }
    }

    render() {
        const {children, title, href} = this.props;
        return (
            <li
                ref={r => {
                    this.dropdown = r;
                }}
                className={`dropdown ${this.state.open ? "open" : ""}`}
            >
                <a
                    href={href || "javascript: void 0"}
                    className="dropdown-toggle"
                    role="button"
                    aria-haspopup="true"
                    aria-expanded="false"
                    onClick={e => this.handleToggle(e)}
                >
                    {title} <span className="caret" />
                </a>
                <ul className="dropdown-menu">{children}</ul>
            </li>
        );
    }
}

const NavLink = (
    {type, title}: {type: string, title: string},
    {gettext, user, URL, options}: Context,
) => (
    <Dropdown title={title} href={URL(`/${type}/search`)}>
        <li>
            <form
                action={URL(`/${type}/search`)}
                method="GET"
                className="form-search form-inline dropdown-search"
            >
                <div className="form-group">
                    <input
                        type="search"
                        id="filter"
                        name="filter"
                        placeholder={gettext("Search")}
                        className="form-control search-query"
                    />
                </div>{" "}
                <input
                    type="submit"
                    value={gettext("Search")}
                    className="btn btn-primary"
                />
            </form>
        </li>
        <li>
            <a href={URL(`/${type}/search`)}>{gettext("Browse All")}</a>
        </li>
        {user &&
            user.getEditableSourcesByType[type].length > 0 &&
            options.canAddRecords && (
                <li>
                    <a href={URL(`/${type}/create`)}>{gettext("Create New")}</a>
                </li>
            )}
    </Dropdown>
);

NavLink.contextTypes = childContextTypes;

const SearchForm = (props, {gettext, options, URL}: Context) => (
    <form
        action={URL(`/${Object.keys(options.types)[0]}/search`)}
        method="GET"
        className={"navbar-form navbar-right search"}
    >
        <input
            name="filter"
            type="text"
            className="form-control search-query"
            placeholder={gettext("Search")}
            style={{width: "auto", display: "inline-block"}}
        />{" "}
        <input
            type="submit"
            className="btn btn-primary"
            value={gettext("Search")}
        />
    </form>
);

SearchForm.contextTypes = childContextTypes;

const LocaleMenu = (
    props,
    {lang, originalUrl, options, URL, getOtherURL}: Context,
) => (
    <Dropdown
        title={
            <span>
                <img
                    alt={options.locales[lang]}
                    src={URL(`/images/${lang}.png`)}
                    width="16"
                    height="11"
                />{" "}
                {options.locales[lang]}
            </span>
        }
    >
        {Object.keys(options.locales)
            .filter(locale => locale !== lang)
            .map(locale => (
                <li key={locale}>
                    <a href={getOtherURL(originalUrl, locale)}>
                        <img
                            src={URL(`/images/${locale}.png`)}
                            alt={options.locales[locale]}
                            width="16"
                            height="11"
                        />{" "}
                        {options.locales[locale]}
                    </a>
                </li>
            ))}
    </Dropdown>
);

LocaleMenu.contextTypes = childContextTypes;

const AdminMenu = (props, {URL, gettext}: Context) => (
    <Dropdown title={gettext("Admin")} href={URL("/admin")}>
        <li>
            <a href={URL("/admin/add-user")}>{gettext("Add or Update User")}</a>
        </li>
        <li>
            <a href={URL("/admin/add-users")}>
                {gettext("Bulk Add or Update Users")}
            </a>
        </li>
        <li>
            <a href={URL("/admin/add-source")}>
                {gettext("Add or Update Source")}
            </a>
        </li>
        <li>
            <a href={URL("/admin/add-sources")}>
                {gettext("Bulk Add or Update Sources")}
            </a>
        </li>
        <li>
            <a href={URL("/admin/manage-sources")}>
                {gettext("Manage Sources")}
            </a>
        </li>
    </Dropdown>
);

AdminMenu.contextTypes = childContextTypes;

class Navbar extends React.Component<Props, {open: boolean}> {
    static contextTypes = childContextTypes;

    context: Context;

    constructor(props) {
        super(props);
        this.state = {open: false};
    }

    handleToggle = (e: SyntheticMouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        this.setState({
            open: !this.state.open,
        });
    };

    render() {
        const {children} = this.props;
        const {open} = this.state;
        const {options, URL, gettext} = this.context;

        return (
            <div className="navbar navbar-default navbar-static-top">
                <div className="container">
                    <div className="navbar-header">
                        <button
                            type="button"
                            className="navbar-toggle"
                            data-toggle="collapse"
                            data-target="#header-navbar"
                            onClick={this.handleToggle}
                        >
                            <span className="sr-only">
                                {gettext("Toggle Navigation")}
                            </span>
                            <span className="icon-bar" />
                            <span className="icon-bar" />
                            <span className="icon-bar" />
                        </button>
                        <a className="navbar-brand" href={URL("/")}>
                            <Logo />
                            {options.getShortTitle}
                        </a>
                    </div>

                    <div
                        id="header-navbar"
                        className={open ? "" : "collapse navbar-collapse"}
                    >
                        {children}
                    </div>
                </div>
            </div>
        );
    }
}

const Header = (props, {gettext, user, options, URL}: Context) => (
    <Navbar>
        <ul className="nav navbar-nav">
            {Object.keys(options.types).map(type => {
                const title = options.types[type].name;
                return <NavLink type={type} title={title} key={type} />;
            })}
            {user && user.siteAdmin && <AdminMenu />}
            {!user && (
                <li>
                    <a href={URL("/login")}>{gettext("Login")}</a>
                </li>
            )}
            {user && (
                <li>
                    <a href={URL("/logout")}>{gettext("Logout")}</a>
                </li>
            )}
            {Object.keys(options.locales).length > 1 && <LocaleMenu />}
        </ul>

        {Object.keys(options.types).length === 1 && <SearchForm />}
    </Navbar>
);

Header.contextTypes = childContextTypes;

const Page = ({children}: Props) => (
    <div>
        <Header />
        <div className="container">{children}</div>
    </div>
);

module.exports = Page;

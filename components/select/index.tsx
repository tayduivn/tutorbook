import { List, ListItem, ListItemGraphic } from '@rmwc/list';
import { MenuSurface, MenuSurfaceAnchor } from '@rmwc/menu';
import { TextField, TextFieldHTMLProps, TextFieldProps } from '@rmwc/textfield';
import { Checkbox } from '@rmwc/checkbox';
import { Chip } from '@rmwc/chip';
import { MDCMenuSurfaceFoundation } from '@material/menu-surface';
import {
  Component,
  FormEvent,
  MouseEvent,
  MutableRefObject,
  RefObject,
  SyntheticEvent,
  createRef,
} from 'react';
import to from 'await-to-js';

import { Option, TCallback } from 'lib/model';

import SelectHint from './select-hint';
import styles from './select.module.scss';

type TextFieldPropOverrides = 'textarea' | 'onFocus' | 'onBlur';

interface SelectState<T, O extends Option<T> = Option<T>> {
  suggestionsOpen: boolean;
  suggestions: O[];
  inputValue: string;
  lineBreak: boolean;
  errored: boolean;
}

interface UniqueSelectProps<T, O extends Option<T> = Option<T>> {
  value: O[];
  onChange: TCallback<O[]>;
  getSuggestions: (query: string) => Promise<O[]>;
  forceUpdateSuggestions?: boolean;
  noResultsMessage: string;
  renderToPortal?: boolean;
  autoOpenMenu?: boolean;
  singleLine?: boolean;
  focused?: boolean;
  onFocused?: () => any;
  onBlurred?: () => any;
}

type Overrides<T> =
  | TextFieldPropOverrides
  | keyof UniqueSelectProps<T>
  | keyof JSX.IntrinsicClassAttributes<Select<T>>;

export type SelectProps<T, O extends Option<T> = Option<T>> = Omit<
  TextFieldHTMLProps,
  Overrides<T>
> &
  Omit<TextFieldProps, Overrides<T>> &
  UniqueSelectProps<T, O>;

/**
 * Each `Select` component provides a wrapper around the base `Select`
 * component (defined in this file). Those wrappers:
 * 1. Provide a surface on which to control the values selected.
 * 2. Syncs those values with internally stored `Option[]` state by querying our
 * Algolia search indices.
 * 3. Also exposes that `Option[]` state if needed by the parent component.
 */
export interface SelectControls<T, O extends Option<T> = Option<T>> {
  value: T[];
  onChange: (value: T[]) => void;
  selected: O[];
  onSelectedChange: (options: O[]) => void;
}

export type SelectControllerProps<T, O extends Option<T> = Option<T>> = Omit<
  SelectProps<T, O>,
  | keyof SelectControls<T, O>
  | 'getSuggestions'
  | 'noResultsMessage'
  | 'forceUpdateSuggestions'
> &
  Partial<SelectControls<T, O>>;

export default class Select<
  T,
  O extends Option<T> = Option<T>
> extends Component<SelectProps<T, O>, SelectState<T, O>> {
  private suggestionsTimeoutID?: ReturnType<typeof setTimeout>;

  private foundationRef: RefObject<MDCMenuSurfaceFoundation>;

  private inputRef: RefObject<HTMLInputElement>;

  private ghostElementRef: RefObject<HTMLSpanElement>;

  private lastSelectedRef: MutableRefObject<Option<T> | null>;

  private textareaBreakWidth: MutableRefObject<number | null>;

  private hasOpenedSuggestions = false;

  public constructor(props: SelectProps<T, O>) {
    super(props);
    this.state = {
      suggestionsOpen: false,
      suggestions: [],
      errored: false,
      inputValue: '',
      lineBreak: false,
    };
    this.foundationRef = createRef();
    this.inputRef = createRef();
    this.lastSelectedRef = createRef();
    this.ghostElementRef = createRef();
    this.textareaBreakWidth = createRef();
    this.maybeOpenSuggestions = this.maybeOpenSuggestions.bind(this);
    this.openSuggestions = this.openSuggestions.bind(this);
    this.closeSuggestions = this.closeSuggestions.bind(this);
    this.updateInputValue = this.updateInputValue.bind(this);
    this.updateInputLine = this.updateInputLine.bind(this);
  }

  public componentDidMount(): void {
    void this.updateSuggestions();
  }

  /**
   * Ensure that the select menu is positioned correctly **even** if it's anchor
   * (the `TextField`) changes shape.
   * @see {@link https://github.com/jamesmfriedman/rmwc/issues/611}
   */
  public componentDidUpdate({
    forceUpdateSuggestions: prevForceUpdateSuggestions,
  }: SelectProps<T, O>): void {
    const { inputValue } = this.state;
    const { focused, forceUpdateSuggestions } = this.props;
    const shouldChangeInputValue: boolean =
      (inputValue === '' || inputValue === '\xa0') &&
      this.inputValue !== inputValue;
    /* eslint-disable-next-line react/no-did-update-set-state */
    if (shouldChangeInputValue) this.setState({ inputValue: this.inputValue });
    if (this.foundationRef.current) {
      /* eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
      (this.foundationRef.current as any).autoPosition_();
    }
    if (focused && this.inputRef.current) this.inputRef.current.focus();
    if (forceUpdateSuggestions && !prevForceUpdateSuggestions) {
      void this.updateSuggestions();
    }
  }

  /**
   * The `TextField`'s label should float if any of the following is true:
   * - The `TextField`'s value isn't empty.
   * - The `TextField` is focused.
   * - There are options selected (this is the only thing that's custom).
   *
   * Make sure to float the `TextField`'s label if there are options selected.
   * @see {@link https://github.com/jamesmfriedman/rmwc/issues/601}
   * @see {@link https://github.com/tutorbookapp/covid-tutoring/issues/8}
   */
  private get inputValue(): string {
    const { value } = this.props;
    return value.length > 0 ? '\xa0' : '';
  }

  private async updateSuggestions(query = ''): Promise<void> {
    const { getSuggestions } = this.props;
    const [err, options] = await to<O[]>(getSuggestions(query));
    if (err) {
      this.setState({ suggestions: [], errored: true });
    } else {
      this.setState({ suggestions: options as O[], errored: false });
    }
  }

  /**
   * We clear the timeout set by `this.closeSuggestions` to ensure that the
   * user doesn't get a blip where the suggestion select menu disappears and
   * reappears abruptly.
   * @see {@link https://bit.ly/2x9eM27}
   */
  private openSuggestions(): void {
    const { suggestionsOpen } = this.state;
    if (this.suggestionsTimeoutID) {
      clearTimeout(this.suggestionsTimeoutID);
      this.suggestionsTimeoutID = undefined;
    }
    if (!suggestionsOpen) {
      this.hasOpenedSuggestions = true;
      this.setState({ suggestionsOpen: true });
    }
  }

  private closeSuggestions(): void {
    const { suggestionsOpen } = this.state;
    this.suggestionsTimeoutID = setTimeout(() => {
      if (suggestionsOpen) {
        this.setState({ suggestionsOpen: false });
        this.lastSelectedRef.current = null;
      }
    }, 0);
  }

  /**
   * Workaround for styling the input as if it has content. If there are
   * options selected (in the given `options` object) and the `TextField`
   * would otherwise be empty, this will update the current input's value to a
   * string containing a space (`' '`) so that the `TextField` styles itself as
   * if it were filled. Otherwise, this acts as it normally would by updating
   * the `TextField`'s value using `setState`.
   * @see {@link https://github.com/jamesmfriedman/rmwc/issues/601}
   */
  private updateInputValue(event: FormEvent<HTMLInputElement>): void {
    const inputValue: string = event.currentTarget.value || this.inputValue;
    this.updateInputLine(event);
    this.setState({ inputValue });
    void this.updateSuggestions(event.currentTarget.value);
    this.openSuggestions();
  }

  /**
   * We don't show the suggestion menu until after the user has started typing.
   * That way, the user learns that they can type to filter/search the options.
   * After they learn that (i.e. after the menu has been opened at least once),
   * we revert back to the original behavior (i.e. opening the menu whenever the
   * `TextField` input is focused).
   */
  private maybeOpenSuggestions(): void {
    const { autoOpenMenu } = this.props;
    if (autoOpenMenu || this.hasOpenedSuggestions) this.openSuggestions();
  }

  /**
   * This function pushes `<textarea>` to the next line when it's width is less
   * than the width of its text content.
   *
   * To measure the width of the content, the width of the invisible `<span>` is
   * used (to which the value of `<textarea>` is then assigned).
   */
  private updateInputLine(event: FormEvent<HTMLInputElement>): void {
    const { singleLine } = this.props;
    if (singleLine && this.ghostElementRef.current && this.inputRef.current) {
      this.ghostElementRef.current.innerText = event.currentTarget.value;
      this.inputRef.current.style.width = `${Math.ceil(
        this.ghostElementRef.current.clientWidth + 0.5
      )}px`;
    } else if (!singleLine && this.ghostElementRef.current) {
      this.ghostElementRef.current.innerText = event.currentTarget.value;

      if (
        this.ghostElementRef.current.clientWidth >
        event.currentTarget.clientWidth
      ) {
        this.textareaBreakWidth.current = event.currentTarget.clientWidth;
        this.setState({ lineBreak: true });
        return;
      }

      if (
        this.textareaBreakWidth.current &&
        this.ghostElementRef.current.clientWidth <=
          this.textareaBreakWidth.current
      ) {
        this.textareaBreakWidth.current = null;
        this.setState({ lineBreak: false });
      }
    }
  }

  /**
   * Selects or un-selects the given option string by setting it's value in
   * `this.state.selected` to `true` which:
   * 1. Checks it's corresponding `mdc-checkbox` within our drop-down menu.
   * 2. Adding it as a chip to the `mdc-text-field` content.
   */
  private updateSelected(option: O, event?: MouseEvent): void {
    const { value, onChange } = this.props;
    const { suggestions, inputValue } = this.state;
    const selected: O[] = Array.from(value);
    const selectedIndex: number = selected.findIndex(
      (s: O) => s.value === option.value
    );
    if (selectedIndex < 0) {
      selected.push(option);
    } else {
      selected.splice(selectedIndex, 1);
    }

    if (suggestions.length && this.lastSelectedRef.current && event?.shiftKey) {
      // Select/unselect multiple options with 'SHIFT + click'
      const idx: number = suggestions.indexOf(option);
      const idxOfLast: number = suggestions.findIndex(
        (s: O) => s.value === (this.lastSelectedRef.current || {}).value
      );
      suggestions
        .slice(Math.min(idx, idxOfLast), Math.max(idx, idxOfLast) + 1)
        .forEach((suggestion: O) => {
          const index: number = selected.findIndex(
            (s: O) => s.value === suggestion.value
          );
          if (selectedIndex < 0 && index < 0) {
            selected.push(suggestion);
          } else if (selectedIndex >= 0 && index >= 0) {
            selected.splice(index, 1);
          }
        });
    }

    this.lastSelectedRef.current = option;

    onChange(selected);
    this.setState({
      inputValue: selectedIndex < 0 ? '' : inputValue,
      lineBreak: false,
    });
  }

  private renderSuggestionMenuItems(): JSX.Element[] | JSX.Element {
    const { errored, suggestions } = this.state;
    const { value, noResultsMessage } = this.props;
    const noResults: JSX.Element = (
      <div className={styles.noResults}>
        {errored ? 'Errored, try again' : noResultsMessage}
      </div>
    );
    const suggestionMenuItems: JSX.Element[] = [];
    suggestions.forEach((option: O) =>
      suggestionMenuItems.push(
        <ListItem
          key={
            typeof option.value === 'string' || typeof option.value === 'number'
              ? option.value
              : option.label
          }
          onClick={(event: MouseEvent) => this.updateSelected(option, event)}
          className={styles.menuItem}
        >
          <ListItemGraphic
            icon={
              <Checkbox
                checked={
                  value.findIndex(
                    (selected: O) => selected.value === option.value
                  ) >= 0
                }
                readOnly
              />
            }
          />
          {option.label}
        </ListItem>
      )
    );
    return suggestionMenuItems.length ? suggestionMenuItems : noResults;
  }

  private renderSelectedChipItems(): JSX.Element[] {
    const { value } = this.props;
    return value.map((option: O) => (
      <Chip
        key={
          typeof option.value === 'string' || typeof option.value === 'number'
            ? option.value
            : option.label
        }
        label={option.label}
        trailingIcon='close'
        onTrailingIconInteraction={() => this.updateSelected(option)}
        className={styles.chip}
      />
    ));
  }

  /**
   * @todo Allow the user to interact with the static content of the menu (i.e.
   * the text that doesn't cause an `onFocus` event when clicked). Right now,
   * interacting with such static content within the menu causes the menu to
   * lose focus which makes us close it.
   */
  public render(): JSX.Element {
    const {
      value,
      onChange,
      getSuggestions,
      noResultsMessage,
      forceUpdateSuggestions,
      renderToPortal,
      autoOpenMenu,
      singleLine,
      className,
      focused,
      onFocused,
      onBlurred,
      ...textFieldProps
    } = this.props;
    const { suggestionsOpen, suggestions, inputValue, lineBreak } = this.state;
    return (
      <MenuSurfaceAnchor className={className}>
        <MenuSurface
          foundationRef={this.foundationRef}
          open={suggestionsOpen}
          onFocus={(event: SyntheticEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            if (this.inputRef.current) this.inputRef.current.focus();
          }}
          anchorCorner='bottomStart'
          renderToPortal={renderToPortal ? '#portal' : false}
          className={!suggestions.length ? styles.errMenu : ''}
        >
          <List>{this.renderSuggestionMenuItems()}</List>
        </MenuSurface>
        <SelectHint open={suggestionsOpen}>
          <TextField
            {...textFieldProps}
            textarea
            inputRef={this.inputRef}
            value={inputValue}
            onFocus={() => {
              if (onFocused) onFocused();
              this.maybeOpenSuggestions();
            }}
            onBlur={() => {
              if (onBlurred) onBlurred();
              this.closeSuggestions();
            }}
            onChange={this.updateInputValue}
            className={styles.textField}
          >
            {this.renderSelectedChipItems()}
            {lineBreak && <div className={styles.lineBreak} />}
            <span ref={this.ghostElementRef} className={styles.ghost} />
          </TextField>
        </SelectHint>
      </MenuSurfaceAnchor>
    );
  }
}
